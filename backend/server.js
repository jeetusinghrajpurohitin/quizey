require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pdfParse = require('pdf-parse');
let OpenAI = null;
try {
  OpenAI = require('openai');
} catch (error) {
  OpenAI = null;
}
const app = express();
const PORT = process.env.PORT || 5001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'quizpulse-local-dev-secret';
const STORE_PATH = path.join(__dirname, 'data', 'store.json');
const PASS_THRESHOLD = 80;
const SKILL_PASS_THRESHOLD = 85;
const SKILL_QUESTION_COUNT = 40;
const SKILL_DURATION_SECONDS = 40 * 60;
const CLASS_OPTIONS = ['DA', 'CYBERSECURITY', 'CSC', 'AIML'];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const AI_PROVIDER = process.env.AI_PROVIDER || 'local';
const openai = AI_PROVIDER === 'openai' && OpenAI && process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
let activeSessions = [];
let liveRooms = {};
function uid(prefix) { return `${prefix}_${crypto.randomUUID()}`; }
function nowIso() { return new Date().toISOString(); }
function slugify(value) {
  return String(value || 'assessment').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'assessment';
}
function normalizeClassName(value) {
  if (!value) return value;
  const normalized = String(value).trim().toUpperCase();
  if (normalized === 'IML') return 'AIML';
  return normalized;
}
function normalizeClassList(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(normalizeClassName).filter(Boolean)));
}
function getQuizType(q) {
  if (q.quizType) return q.quizType;
  if (q.createdBy === 'SYSTEM_SKILL_ASSESSMENT') return 'skill';
  if (q.createdBy === 'SYSTEM_ASSESSMENT') return 'student-assessment';
  return 'classroom';
}
function quizRequiresStart(q) {
  if (typeof q.requiresStart === 'boolean') return q.requiresStart;
  return getQuizType(q) === 'classroom';
}
function getQuizSettings(q) {
  return {
    instantFeedback: false,
    shuffleQuestions: false,
    shuffleOptions: false,
    lockBackward: false,
    timer: 20,
    totalTimerSeconds: null,
    ...(q.settings || {})
  };
}
function isQuizAssignedToStudent(q, user) {
  const targetClasses = normalizeClassList(q.targetClasses || []);
  if (targetClasses.length === 0) return true;
  return targetClasses.includes(normalizeClassName(user.userClass));
}
function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function normalizeQuestionTimes(times, count) {
  const source = Array.isArray(times) ? times : [];
  return Array.from({ length: count }, (_, index) => Math.max(0, Math.round(normalizeNumber(source[index], 0))));
}
function countAnswered(answers = []) {
  return answers.filter(answer => answer !== null && answer !== undefined).length;
}
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password, passwordHash) {
  const [salt, originalHash] = passwordHash.split(':');
  const nextHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(nextHash, 'hex'));
}
function createToken(user) {
  const payload = Buffer.from(JSON.stringify({ sub: user.id, role: user.role, email: user.email, iat: Date.now() })).toString('base64url');
  return `${payload}.${crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url')}`;
}
function parseToken(token) {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  if (crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url') !== signature) return null;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch (e) { return null; }
}
function sanitizeUser(u) {
  const { passwordHash, ...safe } = u;
  if (safe.userClass) safe.userClass = normalizeClassName(safe.userClass);
  return safe;
}
function sanitizeQuizForStudent(q) { 
  return { 
    id: q.id, topic: q.topic, title: q.title, description: q.description, 
    difficulty: q.difficulty, estimatedMinutes: q.estimatedMinutes, 
    passScore: q.passScore, questionCount: q.questions.length,
    targetClasses: normalizeClassList(q.targetClasses || []),
    quizType: getQuizType(q),
    requiresStart: quizRequiresStart(q),
    settings: getQuizSettings(q)
  }; 
}
function sanitizeQuizForAttempt(q) { 
  return { 
    id: q.id, topic: q.topic, title: q.title, description: q.description, 
    difficulty: q.difficulty, estimatedMinutes: q.estimatedMinutes, 
    passScore: q.passScore, 
    quizType: getQuizType(q),
    requiresStart: quizRequiresStart(q),
    settings: getQuizSettings(q),
    questions: q.questions.map(qu => ({ 
      id: qu.id, prompt: qu.prompt, options: qu.options, 
      explanation: qu.explanation || 'No explanation provided.', 
      timer: qu.timer || 20 
    })) 
  }; 
}
function createSeedData() {
  const adminId = uid('user'); const studentId = uid('user');
  return {
    users: [
      { id: adminId, name: 'Ava Admin', email: 'admin@quizpulse.ai', passwordHash: hashPassword('Admin@123'), role: 'admin', skills: [], progress: [], createdAt: nowIso() },
      { id: studentId, name: 'Mia Student', email: 'student@quizpulse.ai', passwordHash: hashPassword('Student@123'), role: 'student', userClass: 'CYBERSECURITY', skills: [], progress: [], createdAt: nowIso() },
      { id: uid('user'), name: 'Jax Coder', email: 'jax@demo.ai', passwordHash: hashPassword('123'), role: 'student', userClass: 'CSC', skills: ['javascript', 'react'], progress: [], createdAt: nowIso() },
    ],
    quizzes: [{
      id: uid('quiz'), topic: 'javascript', title: 'JavaScript Essentials Sprint', description: 'Basic DOM concepts.', difficulty: 'Beginner', estimatedMinutes: 8, passScore: PASS_THRESHOLD, createdBy: adminId, status: 'active',
      questions: [{ id: uid('q'), prompt: 'What does === check in JS?', options: ['Value', 'Type', 'Value and Type', 'Ref'], answerIndex: 2, explanation: 'Strict equality.' }]
    }],
    attempts: [],
    partialAttempts: {}
  };
}
function ensureStore() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) fs.writeFileSync(STORE_PATH, JSON.stringify(createSeedData(), null, 2));
}
function readStore() { ensureStore(); return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); }
function writeStore(s) { fs.writeFileSync(STORE_PATH, JSON.stringify(s, null, 2)); }
function buildStudentProgress(u, s) {
  const atts = s.attempts.filter(a => a.userId === u.id).sort((a, b) => new Date(a.takenAt) - new Date(b.takenAt));
  let totalRight = 0; let totalWrong = 0; let currentStreak = 0;

  atts.forEach(a => {
    totalRight += a.correctAnswers;
    totalWrong += (a.totalQuestions - a.correctAnswers);
    if (a.passed) { currentStreak += 1; } else { currentStreak = 0; }
  });

  const totalQuestionsAns = totalRight + totalWrong;
  const overallAccuracy = totalQuestionsAns === 0 ? 0 : Math.round((totalRight / totalQuestionsAns) * 100);
  const cheatedCount = atts.filter(a => a.isCheated).length;
  const totalAlerts = atts.reduce((sum, a) => sum + (a.alerts || 0), 0);
  const rankPoints = calculateRankPoints(u, s);
  return {
    timeline: atts.map((a, i) => ({ index: i + 1, topic: a.topic, score: a.score, passed: a.passed, takenAt: a.takenAt, isCheated: a.isCheated || false, alerts: a.alerts || 0, quizType: a.quizType || 'classroom' })),
    stats: {
      quizzesTaken: atts.length,
      averageScore: atts.length ? Math.round(atts.reduce((sum, a) => sum + a.score, 0) / atts.length) : 0,
      skillsUnlocked: u.skills?.length || 0,
      passRate: atts.length ? Math.round((atts.filter(a => a.passed).length / atts.length) * 100) : 0,
      totalRight, totalWrong, overallAccuracy, currentStreak, cheatedCount, totalAlerts, rankPoints
    }
  };
}
function calculateRankPoints(user, store) {
  const attempts = store.attempts.filter(a => a.userId === user.id);
  const skills = user.skills?.length || 0;
  const passed = attempts.filter(a => a.passed).length;
  const avgScore = attempts.length ? Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length) : 0;
  const totalAlerts = attempts.reduce((sum, a) => sum + (a.alerts || 0), 0);
  const cheated = attempts.filter(a => a.isCheated).length;
  const currentStreak = buildStreak(attempts);
  const points = (skills * 120) + (passed * 35) + avgScore + (currentStreak * 15) - (totalAlerts * 10) - (cheated * 80);
  return Math.max(0, Math.round(points));
}
function buildStreak(attempts) {
  return attempts
    .slice()
    .sort((a, b) => new Date(a.takenAt) - new Date(b.takenAt))
    .reduce((streak, attempt) => (attempt.passed ? streak + 1 : 0), 0);
}
function buildLeaderboard(store) {
  const students = store.users.filter(u => u.role === 'student');
  const rankings = students.map(u => {
    const p = buildStudentProgress(u, store);
    const attempts = store.attempts.filter(a => a.userId === u.id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      userClass: normalizeClassName(u.userClass),
      skills: u.skills?.length || 0,
      rankPoints: p.stats.rankPoints,
      accuracy: p.stats.overallAccuracy,
      streak: p.stats.currentStreak,
      quizzesTaken: attempts.length,
      cheatedCount: p.stats.cheatedCount,
      totalAlerts: p.stats.totalAlerts
    };
  });
  rankings.sort((a, b) => {
    if (b.rankPoints !== a.rankPoints) return b.rankPoints - a.rankPoints;
    if (b.skills !== a.skills) return b.skills - a.skills;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    return b.streak - a.streak;
  });
  return rankings.map((entry, index) => ({ ...entry, rank: index + 1 }));
}
function buildClassStats(store) {
  const classes = Array.from(new Set([...CLASS_OPTIONS, ...store.users.map(u => normalizeClassName(u.userClass)).filter(Boolean)]));
  const leaderboard = buildLeaderboard(store);
  return classes.map(className => {
    const students = store.users.filter(u => u.role === 'student' && normalizeClassName(u.userClass) === className);
    const studentIds = new Set(students.map(s => s.id));
    const attempts = store.attempts.filter(a => studentIds.has(a.userId));
    const totalRight = attempts.reduce((sum, a) => sum + a.correctAnswers, 0);
    const totalQuestions = attempts.reduce((sum, a) => sum + a.totalQuestions, 0);
    const rankPoints = students.reduce((sum, student) => sum + calculateRankPoints(student, store), 0);
    const topStudent = leaderboard.find(entry => entry.userClass === className) || null;
    return {
      className,
      students: students.length,
      attempts: attempts.length,
      avgScore: attempts.length ? Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length) : 0,
      accuracy: totalQuestions ? Math.round((totalRight / totalQuestions) * 100) : 0,
      skills: students.reduce((sum, student) => sum + (student.skills?.length || 0), 0),
      rankPoints,
      alerts: attempts.reduce((sum, a) => sum + (a.alerts || 0), 0),
      cheated: attempts.filter(a => a.isCheated).length,
      passRate: attempts.length ? Math.round((attempts.filter(a => a.passed).length / attempts.length) * 100) : 0,
      topStudent
    };
  }).sort((a, b) => b.rankPoints - a.rankPoints);
}
function buildAttemptAnswerDetails(quiz, attempt) {
  const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
  const times = normalizeQuestionTimes(attempt.questionTimes, quiz.questions.length);
  return quiz.questions.map((question, index) => {
    const selectedIndex = answers[index];
    const isAnswered = selectedIndex !== null && selectedIndex !== undefined;
    const isCorrect = !attempt.isCheated && selectedIndex === question.answerIndex;
    return {
      questionId: question.id,
      prompt: question.prompt,
      options: question.options,
      selectedIndex: isAnswered ? selectedIndex : null,
      selectedOption: isAnswered ? question.options[selectedIndex] : null,
      correctIndex: question.answerIndex,
      correctOption: question.options[question.answerIndex],
      isCorrect,
      timeSpentSeconds: times[index] || 0,
      explanation: question.explanation || 'No explanation provided.'
    };
  });
}
function buildQuestionStats(quiz, attempts) {
  return quiz.questions.map((question, index) => {
    const optionCounts = question.options.map((option, optionIndex) => ({
      optionIndex,
      option,
      count: attempts.filter(a => Array.isArray(a.answers) && a.answers[index] === optionIndex).length
    }));
    const correct = attempts.filter(a => !a.isCheated && Array.isArray(a.answers) && a.answers[index] === question.answerIndex).length;
    const answered = attempts.filter(a => Array.isArray(a.answers) && a.answers[index] !== null && a.answers[index] !== undefined).length;
    const times = attempts.map(a => normalizeQuestionTimes(a.questionTimes, quiz.questions.length)[index] || 0).filter(time => time > 0);
    return {
      questionId: question.id,
      prompt: question.prompt,
      correctAnswer: question.options[question.answerIndex],
      correct,
      wrong: Math.max(0, answered - correct),
      skipped: Math.max(0, attempts.length - answered),
      accuracy: answered ? Math.round((correct / answered) * 100) : 0,
      avgTimeSeconds: times.length ? Math.round(times.reduce((sum, time) => sum + time, 0) / times.length) : 0,
      optionCounts
    };
  });
}
function averageQuestionTime(questionTimes = []) {
  const timedQuestions = (Array.isArray(questionTimes) ? questionTimes : []).filter(time => time > 0);
  return timedQuestions.length ? Math.round(timedQuestions.reduce((sum, time) => sum + time, 0) / timedQuestions.length) : 0;
}
function buildAttemptReport(store, attempt) {
  const quiz = store.quizzes.find(q => q.id === attempt.quizId);
  const user = store.users.find(u => u.id === attempt.userId);
  return {
    id: attempt.id,
    quizId: attempt.quizId,
    quizTitle: quiz ? quiz.title : attempt.topic,
    topic: attempt.topic,
    quizType: attempt.quizType || (quiz ? getQuizType(quiz) : 'classroom'),
    userId: attempt.userId,
    userName: user ? user.name : 'Unknown User',
    email: user ? user.email : null,
    parentEmail: user ? user.parentEmail || null : null,
    userClass: user ? normalizeClassName(user.userClass) : 'N/A',
    score: attempt.score,
    passed: attempt.passed,
    isCheated: Boolean(attempt.isCheated),
    alerts: attempt.alerts || 0,
    correctAnswers: attempt.correctAnswers,
    wrongAnswers: attempt.totalQuestions - attempt.correctAnswers,
    totalQuestions: attempt.totalQuestions,
    accuracy: attempt.totalQuestions ? Math.round((attempt.correctAnswers / attempt.totalQuestions) * 100) : 0,
    timeSpentSeconds: attempt.timeSpentSeconds || 0,
    avgTimePerQuestion: averageQuestionTime(attempt.questionTimes),
    rankPenalty: (attempt.alerts || 0) * 10 + (attempt.isCheated ? 80 : 0),
    takenAt: attempt.takenAt,
    answers: quiz ? buildAttemptAnswerDetails(quiz, attempt) : []
  };
}
function buildStudentReport(store, studentId) {
  const user = store.users.find(u => u.id === studentId && u.role === 'student');
  if (!user) return null;
  const leaderboard = buildLeaderboard(store);
  const classLeaderboard = leaderboard.filter(entry => entry.userClass === normalizeClassName(user.userClass));
  const attempts = store.attempts
    .filter(a => a.userId === user.id)
    .sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt))
    .map(a => buildAttemptReport(store, a));
  return {
    user: sanitizeUser(user),
    leaderboard: leaderboard.find(entry => entry.id === user.id) || null,
    classRank: classLeaderboard.findIndex(entry => entry.id === user.id) + 1 || null,
    progress: buildStudentProgress(user, store),
    attempts
  };
}
function buildAdminOverview(s, sessions = []) {
  const totalStudents = s.users.filter(u => u.role === 'student').length;
  const totalQuizzes = s.quizzes.length;
  const totalAttempts = s.attempts.length;
  return {
    stats: { totalStudents, totalQuizzes, totalAttempts, averageScore: totalAttempts ? Math.round(s.attempts.reduce((sum, a) => sum + a.score, 0) / totalAttempts) : 0 },
    quizzes: s.quizzes.map(q => { 
      const qa = s.attempts.filter(a => a.quizId === q.id); 
      const live = summarizeLiveRoom(q.id);
      return { 
        id: q.id, title: q.title, difficulty: q.difficulty, questionCount: q.questions.length, 
        attempts: qa.length, avgScore: qa.length ? Math.round(qa.reduce((sum, a) => sum + a.score, 0) / qa.length) : 0, 
        status: q.status, quizType: getQuizType(q), requiresStart: quizRequiresStart(q),
        liveStarted: live.started, liveWaitingCount: live.totalStudents, liveSubmittedCount: live.submittedCount
      }; 
    }),
    classStats: buildClassStats(s),
    leaderboard: buildLeaderboard(s).slice(0, 10),
    students: buildLeaderboard(s),
    liveSessions: sessions
  };
}
function getLiveRoom(quizId) {
  if (!liveRooms[quizId]) {
    liveRooms[quizId] = {
      quizId,
      started: false,
      startedAt: null,
      participants: {}
    };
  }
  return liveRooms[quizId];
}
function summarizeLiveRoom(quizId) {
  const room = liveRooms[quizId];
  if (!room) {
    return { quizId, started: false, startedAt: null, totalStudents: 0, submittedCount: 0, averageScore: 0, participants: [] };
  }
  const participants = Object.values(room.participants || {}).map(p => ({
    userId: p.userId,
    displayName: p.displayName,
    email: p.email,
    parentEmail: p.parentEmail || null,
    joinedAt: p.joinedAt,
    updatedAt: p.updatedAt,
    answersCount: p.answersCount || 0,
    totalQuestions: p.totalQuestions || 0,
    correctAnswers: p.correctAnswers || 0,
    score: p.score || 0,
    avgTimePerQuestion: p.avgTimePerQuestion || 0,
    currentIndex: p.currentIndex || 0,
    submitted: Boolean(p.submitted),
    passed: Boolean(p.passed),
    isCheated: Boolean(p.isCheated),
    alerts: p.alerts || 0,
    lastAlertAt: p.lastAlertAt || null
  })).sort((a, b) => {
    if (Number(b.isCheated) !== Number(a.isCheated)) return Number(b.isCheated) - Number(a.isCheated);
    if (b.alerts !== a.alerts) return b.alerts - a.alerts;
    return b.score - a.score;
  });
  const submitted = participants.filter(p => p.submitted);
  return {
    quizId,
    started: room.started,
    startedAt: room.startedAt,
    totalStudents: participants.length,
    submittedCount: submitted.length,
    averageScore: submitted.length ? Math.round(submitted.reduce((sum, p) => sum + p.score, 0) / submitted.length) : 0,
    alertCount: participants.reduce((sum, p) => sum + p.alerts, 0),
    bannedCount: participants.filter(p => p.isCheated).length,
    participants
  };
}
function updateLiveParticipantProgress(store, user, quizId, payload = {}) {
  const room = liveRooms[quizId];
  if (!room || !room.participants[user.id]) return;
  const quiz = store.quizzes.find(q => q.id === quizId);
  if (!quiz) return;
  const answers = Array.isArray(payload.answers) ? payload.answers : [];
  const isCheated = Boolean(payload.isCheated);
  const correctAnswers = isCheated ? 0 : quiz.questions.reduce((count, question, index) => count + (answers[index] === question.answerIndex ? 1 : 0), 0);
  const score = Math.round((correctAnswers / quiz.questions.length) * 100);
  const participant = room.participants[user.id];
  participant.answersCount = answers.filter(a => a !== null && a !== undefined).length;
  participant.correctAnswers = correctAnswers;
  participant.totalQuestions = quiz.questions.length;
  participant.score = score;
  const questionTimes = normalizeQuestionTimes(payload.questionTimes, quiz.questions.length);
  const timedQuestions = questionTimes.filter(time => time > 0);
  participant.avgTimePerQuestion = timedQuestions.length ? Math.round(timedQuestions.reduce((sum, time) => sum + time, 0) / timedQuestions.length) : (participant.avgTimePerQuestion || 0);
  participant.currentIndex = Number.isInteger(payload.currentIndex) ? payload.currentIndex : participant.currentIndex || 0;
  const previousAlerts = participant.alerts || 0;
  participant.alerts = Number.isInteger(payload.alerts) ? payload.alerts : previousAlerts;
  if (participant.alerts > previousAlerts) participant.lastAlertAt = nowIso();
  participant.submitted = Boolean(payload.submitted);
  participant.passed = Boolean(payload.passed);
  participant.isCheated = isCheated;
  participant.updatedAt = nowIso();
}
function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const payload = token ? parseToken(token) : null;
  if (!payload) return res.status(401).json({ message: 'Authentication required.' });
  const s = readStore();
  const u = s.users.find(entry => entry.id === payload.sub);
  if (!u) return res.status(401).json({ message: 'User not found.' });
  req.user = u; req.store = s;
  return next();
}
function roleRequired(roles) {
  return (req, res, next) => {
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(req.user.role)) return res.status(403).json({ message: 'Permission denied.' });
    return next();
  };
}
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const s = readStore();
  const u = s.users.find(entry => entry.email.toLowerCase() === email.toLowerCase().trim());
  if (!u || !verifyPassword(password, u.passwordHash)) return res.status(401).json({ message: 'Invalid credentials.' });
  return res.json({ token: createToken(u), user: sanitizeUser(u) });
});
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role = 'student', userClass, parentEmail } = req.body;
  const s = readStore();
  if (s.users.find(u => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ message: 'Email exists.' });
  const user = { 
    id: uid('user'), name: name.trim(), email: email.trim().toLowerCase(), passwordHash: hashPassword(password), 
    role, userClass: role === 'student' ? normalizeClassName(userClass) : null, parentEmail: role === 'student' && parentEmail ? parentEmail.trim().toLowerCase() : null,
    skills: [], progress: [], createdAt: nowIso() 
  };
  s.users.push(user); writeStore(s);
  return res.status(201).json({ token: createToken(user), user: sanitizeUser(user) });
});
app.get('/api/auth/me', authRequired, (req, res) => res.json({ user: sanitizeUser(req.user) }));
app.get('/api/catalog', authRequired, (req, res) => {
  const quizzes = req.store.quizzes
    .filter(q => q.status === 'active')
    .filter(q => getQuizType(q) !== 'skill' || !q.ownerUserId || q.ownerUserId === req.user.id)
    .filter(q => isQuizAssignedToStudent(q, req.user))
    .map(q => {
      const sanitized = sanitizeQuizForStudent(q);
      const userAttempts = req.store.attempts.filter(a => a.userId === req.user.id && a.quizId === q.id);
      const partial = req.store.partialAttempts?.[req.user.id]?.[q.id] || null;
      return { ...sanitized, userAttempts, partial };
    });
  res.json({ quizzes });
});
app.get('/api/dashboard/student', authRequired, roleRequired('student'), (req, res) => res.json({ 
  user: sanitizeUser(req.user), 
  skills: req.user.skills, 
  progress: buildStudentProgress(req.user, req.store), 
  quizzes: req.store.quizzes
    .filter(q => q.status === 'active')
    .filter(q => getQuizType(q) !== 'skill' || !q.ownerUserId || q.ownerUserId === req.user.id)
    .filter(q => isQuizAssignedToStudent(q, req.user))
    .map(sanitizeQuizForStudent) 
}));
app.get('/api/dashboard/admin', authRequired, roleRequired('admin'), (req, res) => res.json(buildAdminOverview(req.store, activeSessions)));
app.get('/api/quizzes/:quizId', authRequired, roleRequired(['student', 'admin']), (req, res) => {
  const q = req.store.quizzes.find(entry => entry.id === req.params.quizId);
  if (!q) return res.status(404).json({ message: 'Quiz not found.' });
  if (req.user.role === 'student' && !isQuizAssignedToStudent(q, req.user)) {
    return res.status(403).json({ message: 'This quiz is not assigned to your class.' });
  }
  if (req.user.role === 'student' && quizRequiresStart(q)) {
    const room = liveRooms[q.id];
    const participant = room?.participants?.[req.user.id];
    if (!room?.started || !participant) {
      return res.status(423).json({ message: 'Wait for your instructor to start this quiz.', waitingRoomRequired: true, quizId: q.id });
    }
  }
  const partial = req.store.partialAttempts?.[req.user.id]?.[q.id] || null;
  return res.json({ quiz: sanitizeQuizForAttempt(q), partial });
});
app.post('/api/quizzes/:quizId/progress', authRequired, roleRequired('student'), (req, res) => {
  const { answers, currentIndex, alerts, revealed, timeLeft, questionTimes } = req.body;
  const q = req.store.quizzes.find(entry => entry.id === req.params.quizId);
  if (!q) return res.status(404).json({ message: 'Quiz not found.' });
  if (!isQuizAssignedToStudent(q, req.user)) return res.status(403).json({ message: 'This quiz is not assigned to your class.' });
  if (quizRequiresStart(q)) {
    const room = liveRooms[q.id];
    if (!room?.started || !room.participants?.[req.user.id]) {
      return res.status(423).json({ message: 'Wait for your instructor to start this quiz.' });
    }
  }
  if (!req.store.partialAttempts) req.store.partialAttempts = {};
  if (!req.store.partialAttempts[req.user.id]) req.store.partialAttempts[req.user.id] = {};
  const normalizedTimes = normalizeQuestionTimes(questionTimes, q.questions.length);
  req.store.partialAttempts[req.user.id][req.params.quizId] = { answers, currentIndex, alerts, revealed, timeLeft, questionTimes: normalizedTimes, updatedAt: nowIso() };
  updateLiveParticipantProgress(req.store, req.user, req.params.quizId, { answers, currentIndex, alerts, questionTimes: normalizedTimes });
  writeStore(req.store);
  res.json({ ok: true });
});
app.post('/api/quizzes/:quizId/submit', authRequired, roleRequired(['student', 'admin']), (req, res) => {
  const q = req.store.quizzes.find(entry => entry.id === req.params.quizId);
  if (!q) return res.status(404).json({ message: 'Quiz not found.' });
  if (req.user.role === 'student' && !isQuizAssignedToStudent(q, req.user)) {
    return res.status(403).json({ message: 'This quiz is not assigned to your class.' });
  }
  if (req.user.role === 'student' && quizRequiresStart(q)) {
    const room = liveRooms[q.id];
    if (!room?.started || !room.participants?.[req.user.id]) {
      return res.status(423).json({ message: 'Wait for your instructor to start this quiz.' });
    }
  }
  const ans = Array.isArray(req.body.answers) ? req.body.answers : [];
  const isCheated = req.body.isCheated || false;
  const alerts = Math.max(0, parseInt(req.body.alerts || 0, 10) || 0);
  const questionTimes = normalizeQuestionTimes(req.body.questionTimes, q.questions.length);

  let correct = 0;
  if (!isCheated) {
    correct = q.questions.reduce((count, qu, idx) => count + (ans[idx] === qu.answerIndex ? 1 : 0), 0);
  }

  const score = Math.round((correct / q.questions.length) * 100);
  const passed = !isCheated && (score >= q.passScore);

  if (req.user.role === 'admin') return res.json({ result: { score, passed, correctAnswers: correct, totalQuestions: q.questions.length, unlockedSkill: null, isCheated } });
  const att = { 
    id: uid('attempt'), userId: req.user.id, quizId: q.id, topic: q.topic, quizType: getQuizType(q),
    answers: ans, questionTimes, alerts, correctAnswers: correct, totalQuestions: q.questions.length, 
    score, passed, takenAt: nowIso(), isCheated, timeSpentSeconds: questionTimes.reduce((sum, time) => sum + time, 0)
  };
  req.store.attempts.push(att);
  if (!req.store.partialAttempts) req.store.partialAttempts = {};
  if (req.store.partialAttempts[req.user.id]) delete req.store.partialAttempts[req.user.id][req.params.quizId];
  if (!Array.isArray(req.user.skills)) req.user.skills = [];
  const unlockedSkill = getQuizType(q) === 'skill' && passed ? q.topic : null;
  if (unlockedSkill && !req.user.skills.includes(unlockedSkill)) req.user.skills.push(unlockedSkill);
  const idx = req.store.users.findIndex(u => u.id === req.user.id);
  req.store.users[idx] = req.user; writeStore(req.store);
  updateLiveParticipantProgress(req.store, req.user, q.id, { answers: ans, questionTimes, alerts, submitted: true, passed, isCheated });
  activeSessions = activeSessions.filter(s => s.userId !== req.user.id);
  return res.json({
    result: {
      score,
      passed,
      correctAnswers: correct,
      totalQuestions: q.questions.length,
      unlockedSkill,
      isCheated,
      alerts,
      rankPoints: calculateRankPoints(req.user, req.store),
      review: buildAttemptAnswerDetails(q, att)
    }
  });
});
app.post('/api/quiz/session/start', authRequired, roleRequired(['student', 'admin']), (req, res) => {
  const { quizId, quizTitle } = req.body;
  const existingAlerts = req.store.partialAttempts?.[req.user.id]?.[quizId]?.alerts || 0;
  activeSessions = activeSessions.filter(s => s.userId !== req.user.id);
  activeSessions.push({ sessionId: uid('sess'), userId: req.user.id, userName: req.user.name, quizId, quizTitle, alerts: existingAlerts, startTime: nowIso() });
  res.json({ ok: true });
});
app.post('/api/quiz/session/alert', authRequired, roleRequired(['student', 'admin']), (req, res) => {
  const session = activeSessions.find(s => s.userId === req.user.id);
  if (session) { 
    session.alerts += 1; 
    const room = liveRooms[session.quizId];
    const participant = room?.participants?.[req.user.id];
    if (participant) {
      participant.alerts = session.alerts;
      participant.lastAlertAt = nowIso();
      participant.updatedAt = nowIso();
      if (session.alerts >= 3) participant.isCheated = true;
    }
    return res.json({ alerts: session.alerts }); 
  }
  res.json({ alerts: -1 }); // Let frontend handle the increment if session is missing
});
app.post('/api/quiz/session/end', authRequired, roleRequired(['student', 'admin']), (req, res) => {
  activeSessions = activeSessions.filter(s => s.userId !== req.user.id);
  res.json({ ok: true });
});
app.get('/api/admin/live-sessions', authRequired, roleRequired('admin'), (req, res) => res.json({ activeSessions }));
app.post('/api/live/:quizId/join', authRequired, roleRequired('student'), (req, res) => {
  const q = req.store.quizzes.find(entry => entry.id === req.params.quizId);
  if (!q) return res.status(404).json({ message: 'Quiz not found.' });
  if (!isQuizAssignedToStudent(q, req.user)) return res.status(403).json({ message: 'This quiz is not assigned to your class.' });
  if (!quizRequiresStart(q)) return res.json({ started: true, quiz: sanitizeQuizForStudent(q) });
  const room = getLiveRoom(q.id);
  const emailName = req.user.email ? req.user.email.split('@')[0] : req.user.name;
  const displayName = String(req.body.displayName || req.user.name || emailName || 'Student').trim().slice(0, 80);
  room.participants[req.user.id] = {
    ...(room.participants[req.user.id] || {}),
    userId: req.user.id,
    displayName,
    email: req.user.email,
    parentEmail: req.user.parentEmail || null,
    joinedAt: room.participants[req.user.id]?.joinedAt || nowIso(),
    updatedAt: nowIso(),
    answersCount: room.participants[req.user.id]?.answersCount || 0,
    totalQuestions: q.questions.length,
    correctAnswers: room.participants[req.user.id]?.correctAnswers || 0,
    score: room.participants[req.user.id]?.score || 0,
    currentIndex: room.participants[req.user.id]?.currentIndex || 0,
    submitted: room.participants[req.user.id]?.submitted || false,
    passed: room.participants[req.user.id]?.passed || false,
    isCheated: room.participants[req.user.id]?.isCheated || false,
    alerts: room.participants[req.user.id]?.alerts || 0
  };
  return res.json({ started: room.started, quiz: sanitizeQuizForStudent(q), room: summarizeLiveRoom(q.id) });
});
app.get('/api/live/:quizId/status', authRequired, roleRequired('student'), (req, res) => {
  const q = req.store.quizzes.find(entry => entry.id === req.params.quizId);
  if (!q) return res.status(404).json({ message: 'Quiz not found.' });
  if (!isQuizAssignedToStudent(q, req.user)) return res.status(403).json({ message: 'This quiz is not assigned to your class.' });
  if (!quizRequiresStart(q)) return res.json({ started: true, joined: true, quiz: sanitizeQuizForStudent(q) });
  const room = liveRooms[q.id];
  const participant = room?.participants?.[req.user.id] || null;
  return res.json({ started: Boolean(room?.started), joined: Boolean(participant), participant, room: summarizeLiveRoom(q.id), quiz: sanitizeQuizForStudent(q) });
});
app.post('/api/admin/quizzes/:quizId/live/start', authRequired, roleRequired('admin'), (req, res) => {
  const q = req.store.quizzes.find(entry => entry.id === req.params.quizId);
  if (!q) return res.status(404).json({ message: 'Quiz not found.' });
  const room = getLiveRoom(q.id);
  room.started = true;
  room.startedAt = room.startedAt || nowIso();
  return res.json({ room: summarizeLiveRoom(q.id) });
});
app.post('/api/admin/quizzes/:quizId/live/reset', authRequired, roleRequired('admin'), (req, res) => {
  const q = req.store.quizzes.find(entry => entry.id === req.params.quizId);
  if (!q) return res.status(404).json({ message: 'Quiz not found.' });
  liveRooms[q.id] = { quizId: q.id, started: false, startedAt: null, participants: {} };
  return res.json({ room: summarizeLiveRoom(q.id) });
});
app.get('/api/admin/quizzes/:quizId/live', authRequired, roleRequired('admin'), (req, res) => {
  const q = req.store.quizzes.find(entry => entry.id === req.params.quizId);
  if (!q) return res.status(404).json({ message: 'Quiz not found.' });
  return res.json({ quiz: sanitizeQuizForStudent(q), room: summarizeLiveRoom(q.id) });
});
app.get('/api/admin/quizzes/:quizId/results', authRequired, roleRequired('admin'), (req, res) => {
  const q = req.store.quizzes.find(entry => entry.id === req.params.quizId);
  if (!q) return res.status(404).json({ message: 'Quiz not found.' });

  const attempts = req.store.attempts.filter(a => a.quizId === q.id);
  const studentResults = attempts.map(a => buildAttemptReport(req.store, a));

  const total = attempts.length;
  const passedCount = attempts.filter(a => a.passed).length;
  const cheatedCount = attempts.filter(a => a.isCheated).length;
  const avgScore = total ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / total) : 0;
  const totalRight = attempts.reduce((sum, a) => sum + a.correctAnswers, 0);
  const totalQuestions = attempts.reduce((sum, a) => sum + a.totalQuestions, 0);
  const timedAttempts = attempts.filter(a => a.timeSpentSeconds > 0);

  res.json({
    quizId: q.id,
    quizTitle: q.title,
    stats: {
      totalStudents: total,
      passRate: total ? Math.round((passedCount / total) * 100) : 0,
      cheatedRate: total ? Math.round((cheatedCount / total) * 100) : 0,
      avgScore,
      accuracy: totalQuestions ? Math.round((totalRight / totalQuestions) * 100) : 0,
      correctAnswers: totalRight,
      wrongAnswers: Math.max(0, totalQuestions - totalRight),
      totalAlerts: attempts.reduce((sum, a) => sum + (a.alerts || 0), 0),
      avgTimeSeconds: timedAttempts.length ? Math.round(timedAttempts.reduce((sum, a) => sum + a.timeSpentSeconds, 0) / timedAttempts.length) : 0
    },
    questionStats: buildQuestionStats(q, attempts),
    studentResults
  });
});
app.get('/api/admin/students/:studentId/report', authRequired, roleRequired('admin'), (req, res) => {
  const report = buildStudentReport(req.store, req.params.studentId);
  if (!report) return res.status(404).json({ message: 'Student not found.' });
  res.json(report);
});
app.post('/api/admin/quizzes', authRequired, roleRequired('admin'), (req, res) => {
  const { title, topic, description, difficulty, estimatedMinutes, questions, targetClasses, shuffleQuestions, shuffleOptions, instantFeedback, timer, lockBackward } = req.body;
  
  const quiz = {
    id: uid('quiz'),
    title,
    topic,
    description,
    difficulty,
    estimatedMinutes: parseInt(estimatedMinutes, 10),
    passScore: PASS_THRESHOLD,
    createdBy: req.user.id,
    status: 'active',
    quizType: 'classroom',
    requiresStart: true,
    targetClasses: normalizeClassList(targetClasses || []),
    settings: {
      shuffleQuestions: shuffleQuestions ?? true,
      shuffleOptions: shuffleOptions ?? true,
      instantFeedback: instantFeedback ?? false,
      lockBackward: lockBackward ?? false,
      timer: parseInt(timer || 20, 10)
    },
    questions: questions.map(q => ({
      id: uid('q'),
      prompt: q.prompt,
      options: q.options,
      answerIndex: parseInt(q.answerIndex, 10),
      explanation: q.explanation || 'No explanation provided.',
      timer: parseInt(q.timer || timer || 20, 10)
    }))
  };

  req.store.quizzes.unshift(quiz);
  writeStore(req.store);
  res.status(201).json({ quiz: sanitizeQuizForStudent(quiz) });
});
app.delete('/api/admin/quizzes/:id', authRequired, roleRequired('admin'), (req, res) => {
  const idx = req.store.quizzes.findIndex(q => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Quiz not found.' });
  req.store.quizzes.splice(idx, 1);
  writeStore(req.store);
  res.json({ ok: true });
});
// ----------------------------------------------------
// PUBLIC LEADERBOARD ENDPOINT
// ----------------------------------------------------
app.get('/api/leaderboard', authRequired, roleRequired('student'), (req, res) => {
  const store = readStore();
  const leaderboard = buildLeaderboard(store);
  const classLeaderboard = leaderboard.filter(entry => entry.userClass === normalizeClassName(req.user.userClass));
  res.json({ leaderboard, classLeaderboard, classStats: buildClassStats(store) });
});
function mockAIGenerator(contextString, titleOverride, difficulty, quantity) {
  const words = contextString.split(/\s+/).slice(0, 5).join(' ');
  const shortTitle = titleOverride || (words.charAt(0).toUpperCase() + words.slice(1));
  const topicSlug = slugify(shortTitle);

  const bank = [
    { prompt: `What is a fundamental metric of ${shortTitle}?`, options: ['Core Logic', 'Structural Boundaries', 'Synthesization', 'Dependency Injection'], answerIndex: 0 },
    { prompt: `How does ${shortTitle} respond to ${difficulty} edge cases?`, options: ['Static Memory', 'Dynamic Encapsulation', 'Shared Mapping', 'Direct Bypass'], answerIndex: 1 },
    { prompt: `When designing this scope, which occurs first?`, options: ['Testing', 'Initialization', 'Deployment', 'Monitoring'], answerIndex: 1 },
    { prompt: `Which practice aligns best with standard architecture?`, options: ['Redundancy', 'Modularity', 'Isolation', 'Coupling'], answerIndex: 1 },
    { prompt: `What dictates execution flow in this domain?`, options: ['Data Types', 'Control Structures', 'Memory Registers', 'Nothing'], answerIndex: 1 },
    { prompt: `A common anti-pattern here is...`, options: ['Over-fetching', 'Memory leaks', 'Race conditions', 'All above'], answerIndex: 3 },
    { prompt: `To secure this vector, rely on...`, options: ['Ignoring it', 'Sanitizing inputs', 'Compiling', 'Removing dependencies'], answerIndex: 1 },
    { prompt: `True or false: scalability here is purely linear.`, options: ['True', 'False', 'Depends', 'Vertically only'], answerIndex: 1 },
    { prompt: `The most optimal transport is typically...`, options: ['UDP', 'TCP', 'HTTP/3', 'Custom WebSocket'], answerIndex: 2 }
  ];
  let selected = [];
  for (let i = 0; i < quantity; i++) {
    const bQ = bank[i % bank.length];
    selected.push({ ...bQ, prompt: bQ.prompt.replace('?', ` [Variant ${i + 1}]?`), explanation: 'AI generated variant.' });
  }
  selected = selected.sort(() => 0.5 - Math.random());
  return { title: `${shortTitle} - ${difficulty}`, topic: topicSlug, description: `A smart ${quantity}-question autogenerated assessment evaluating knowledge on: ${shortTitle}.`, questions: selected };
}
function normalizeGeneratedQuiz(raw, fallbackTitle, difficulty, quantity) {
  const fallback = mockAIGenerator(fallbackTitle, fallbackTitle, difficulty, quantity);
  const questions = Array.isArray(raw?.questions) ? raw.questions : [];
  const normalized = questions.map((question, index) => {
    const options = Array.isArray(question.options) ? question.options.filter(Boolean).slice(0, 4) : [];
    while (options.length < 4) options.push(`Option ${options.length + 1}`);
    const answerIndex = Number.isInteger(question.answerIndex)
      ? question.answerIndex
      : options.findIndex(option => String(option).toLowerCase() === String(question.correctAnswer || '').toLowerCase());
    return {
      prompt: String(question.prompt || question.question || `Question ${index + 1} about ${fallbackTitle}`),
      options,
      answerIndex: answerIndex >= 0 && answerIndex < options.length ? answerIndex : 0,
      explanation: String(question.explanation || 'Review the core idea behind this answer.')
    };
  });
  const merged = normalized.concat(fallback.questions).slice(0, quantity);
  return {
    title: String(raw?.title || fallback.title),
    topic: slugify(raw?.topic || fallbackTitle),
    description: String(raw?.description || fallback.description),
    questions: merged
  };
}
async function generateQuizContent({ source, title, difficulty, quantity }) {
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.35,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You create classroom quiz content as strict JSON. Return title, topic, description, and questions. Each question must have prompt, exactly four options, answerIndex from 0 to 3, and explanation.'
          },
          {
            role: 'user',
            content: `Create ${quantity} ${difficulty} multiple-choice questions for "${title}". Use this source/context where relevant:\n${source.slice(0, 12000)}`
          }
        ]
      });
      const parsed = JSON.parse(completion.choices?.[0]?.message?.content || '{}');
      return normalizeGeneratedQuiz(parsed, title, difficulty, quantity);
    } catch (error) {
      console.warn('OpenAI quiz generation failed, using local generator:', error.message);
    }
  }
  return mockAIGenerator(source, title, difficulty, quantity);
}
app.post('/api/admin/generate-quiz', authRequired, roleRequired('admin'), async (req, res) => {
  const { topic, difficulty = 'Intermediate', questionCount = 3 } = req.body;
  if (!topic) return res.status(400).json({ message: 'Topic is required.' });
  try {
    const count = parseInt(questionCount, 10);
    const generated = await generateQuizContent({ source: topic, title: topic, difficulty, quantity: count });
    const quiz = { 
      id: uid('quiz'), title: generated.title, topic: generated.topic, description: generated.description, 
      difficulty, estimatedMinutes: Math.ceil(generated.questions.length * 1.5), 
      passScore: PASS_THRESHOLD, createdBy: req.user.id, status: 'active', quizType: 'classroom', requiresStart: true,
      targetClasses: normalizeClassList(req.body.targetClasses || []),
      settings: {
        instantFeedback: req.body.instantFeedback ?? false,
        shuffleQuestions: req.body.shuffleQuestions ?? true,
        shuffleOptions: req.body.shuffleOptions ?? true,
        lockBackward: req.body.lockBackward ?? false,
        timer: parseInt(req.body.timer || 20, 10)
      },
      questions: generated.questions.map(q => ({ id: uid('q'), prompt: q.prompt, options: q.options, answerIndex: q.answerIndex, explanation: q.explanation, timer: parseInt(req.body.timer || 20, 10) })) 
    };
    req.store.quizzes.unshift(quiz); writeStore(req.store);
    return res.status(201).json({ quiz: sanitizeQuizForStudent(quiz) });
  } catch (error) { return res.status(500).json({ message: 'Failed to generate.' }); }
});
app.post('/api/admin/upload-pdf', authRequired, roleRequired('admin'), upload.single('document'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
  const difficulty = req.body.difficulty || 'Advanced';
  const questionCount = parseInt(req.body.questionCount || 5, 10);
  try {
    const pdfData = await pdfParse(req.file.buffer);
    const context = pdfData.text.replace(/\s+/g, ' ').substring(0, 15000);
    const cleanFileName = path.basename(req.file.originalname || 'PDF Assessment', path.extname(req.file.originalname || '')).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'PDF Assessment';
    const generated = await generateQuizContent({ source: context, title: cleanFileName, difficulty, quantity: questionCount });
    const quiz = { 
      id: uid('quiz'), title: generated.title, topic: generated.topic, description: generated.description, 
      difficulty, estimatedMinutes: Math.ceil(questionCount * 1.5), 
      passScore: PASS_THRESHOLD, createdBy: req.user.id, status: 'active', quizType: 'classroom', requiresStart: true,
      targetClasses: normalizeClassList(JSON.parse(req.body.targetClasses || '[]')),
      settings: {
        instantFeedback: req.body.instantFeedback === 'true',
        shuffleQuestions: req.body.shuffleQuestions !== 'false',
        shuffleOptions: req.body.shuffleOptions !== 'false',
        lockBackward: req.body.lockBackward === 'true',
        timer: parseInt(req.body.timer || 20, 10)
      },
      questions: generated.questions.map(q => ({ id: uid('q'), prompt: q.prompt, options: q.options, answerIndex: q.answerIndex, explanation: q.explanation, timer: parseInt(req.body.timer || 20, 10) })) 
    };
    req.store.quizzes.unshift(quiz); writeStore(req.store);
    return res.status(201).json({ quiz: sanitizeQuizForStudent(quiz), message: `Scanned ${pdfData.numpages} pages.` });
  } catch (error) { return res.status(500).json({ message: 'Failed to process PDF safely.' }); }
});
app.post('/api/student/generate-assessment', authRequired, roleRequired('student'), async (req, res) => {
  const { topic, difficulty } = req.body;
  if (!topic || !difficulty) return res.status(400).json({ message: 'Topic and difficulty required.' });
  try {
    const generated = await generateQuizContent({ source: topic, title: `${topic} Practice`, difficulty, quantity: SKILL_QUESTION_COUNT });
    const quiz = { 
      id: uid('quiz'), title: generated.title, topic: generated.topic, description: generated.description, 
      difficulty, estimatedMinutes: 40, passScore: SKILL_PASS_THRESHOLD, createdBy: 'SYSTEM_SKILL_ASSESSMENT', 
      status: 'active', quizType: 'skill', requiresStart: false,
      ownerUserId: req.user.id,
      settings: { instantFeedback: false, shuffleQuestions: true, shuffleOptions: true, lockBackward: true, totalTimerSeconds: SKILL_DURATION_SECONDS },
      questions: generated.questions.map(q => ({ id: uid('q'), prompt: q.prompt, options: q.options, answerIndex: q.answerIndex, explanation: q.explanation })) 
    };
    req.store.quizzes.unshift(quiz); writeStore(req.store);
    return res.status(201).json({ quizId: quiz.id });
  } catch (error) { return res.status(500).json({ message: 'Failed to generate assessment.' }); }
});
app.post('/api/student/generate-skill-assessment', authRequired, roleRequired('student'), async (req, res) => {
  const { topic, difficulty = 'Beginner' } = req.body;
  if (!topic) return res.status(400).json({ message: 'Topic is required.' });
  try {
    const generated = await generateQuizContent({ source: topic, title: `${topic} Skill Challenge`, difficulty, quantity: SKILL_QUESTION_COUNT });
    const quiz = {
      id: uid('quiz'),
      title: generated.title,
      topic: generated.topic,
      description: `Earn the ${topic} skill by scoring ${SKILL_PASS_THRESHOLD}% or higher.`,
      difficulty,
      estimatedMinutes: 40,
      passScore: SKILL_PASS_THRESHOLD,
      createdBy: 'SYSTEM_SKILL_ASSESSMENT',
      status: 'active',
      quizType: 'skill',
      requiresStart: false,
      ownerUserId: req.user.id,
      settings: {
        instantFeedback: false,
        shuffleQuestions: true,
        shuffleOptions: true,
        lockBackward: true,
        totalTimerSeconds: SKILL_DURATION_SECONDS
      },
      questions: generated.questions.map(q => ({ id: uid('q'), prompt: q.prompt, options: q.options, answerIndex: q.answerIndex, explanation: q.explanation }))
    };
    req.store.quizzes.unshift(quiz);
    writeStore(req.store);
    return res.status(201).json({ quizId: quiz.id });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to generate skill assessment.' });
  }
});
// Production Static Serving
app.use(express.static(path.join(__dirname, '../frontend/build')));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});
ensureStore();
app.listen(PORT, () => console.log(`QuizPulse API running on http://localhost:${PORT}`));

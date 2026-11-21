const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { handleActivity, handleChat, handleHealth, handleStudentFirstLogin, handleStudentHistoryDelete, handleStudentLearningPath, handleStudentLog, handleStudentMachineLabAccess, handleStudentSkillProgress, handleSupabaseConfig, handleSupabaseLogin, handleSupabaseSetup, handleTeacherClassroomSettings, handleTeacherRoster, handleTeacherRosterBulk } = require('./api-handler.cjs');

const root = path.join(__dirname, 'dist');
const portIndex = process.argv.indexOf('--port');
const port = Number(process.env.PORT || (portIndex >= 0 && process.argv[portIndex + 1]) || 3000);
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.woff2', 'font/woff2'],
  ['.hwpx', 'application/octet-stream'],
]);

const server = http.createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health' && request.method === 'GET') {
    handleHealth(request, response);
    return;
  }
  if (url.pathname === '/api/supabase-config' && request.method === 'GET') {
    handleSupabaseConfig(request, response);
    return;
  }
  if (url.pathname === '/api/supabase-setup' && request.method === 'GET') {
    await handleSupabaseSetup(request, response);
    return;
  }
  if (url.pathname === '/api/supabase-login' && request.method === 'POST') {
    await handleSupabaseLogin(request, response);
    return;
  }
  if (url.pathname === '/api/student/first-login' && request.method === 'POST') {
    await handleStudentFirstLogin(request, response);
    return;
  }
  if (url.pathname === '/api/student/skill-progress' && ['GET', 'POST'].includes(request.method)) {
    await handleStudentSkillProgress(request, response);
    return;
  }
  if (url.pathname === '/api/student/history' && request.method === 'DELETE') {
    await handleStudentHistoryDelete(request, response);
    return;
  }
  if (url.pathname === '/api/student/learning-path' && ['GET', 'POST'].includes(request.method)) {
    await handleStudentLearningPath(request, response);
    return;
  }
  if (url.pathname === '/api/teacher/roster' && ['GET', 'POST'].includes(request.method)) {
    await handleTeacherRoster(request, response);
    return;
  }
  if (url.pathname === '/api/teacher/roster/bulk' && request.method === 'POST') {
    await handleTeacherRosterBulk(request, response);
    return;
  }
  if (url.pathname === '/api/teacher/classroom-settings' && ['GET', 'POST'].includes(request.method)) {
    await handleTeacherClassroomSettings(request, response);
    return;
  }
  if (url.pathname === '/api/student/machine-lab-access' && request.method === 'GET') {
    await handleStudentMachineLabAccess(request, response);
    return;
  }
  if (url.pathname === '/api/activity' && request.method === 'POST') {
    await handleActivity(request, response);
    return;
  }
  if (url.pathname === '/api/student-log' && request.method === 'POST') {
    await handleStudentLog(request, response);
    return;
  }
  if (url.pathname === '/api/chat') {
    if (request.method !== 'POST') {
      response.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'POST 요청만 지원해요.' }));
      return;
    }
    await handleChat(request, response);
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405);
    response.end();
    return;
  }
  if (url.pathname === '/__preview-bridge.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('');
    return;
  }
  let filePath;
  try {
    const requested = decodeURIComponent(url.pathname);
    filePath = path.resolve(root, `.${requested === '/' ? '/index.html' : requested}`);
  } catch {
    filePath = '';
  }
  if (!filePath || (filePath !== root && !filePath.startsWith(`${root}${path.sep}`))) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, {
      'Content-Type': contentTypes.get(path.extname(filePath)) || 'application/octet-stream',
      ...(path.extname(filePath) === '.hwpx' ? { 'Content-Disposition': "attachment; filename*=UTF-8''%EC%BD%A9%EC%85%88%EC%BD%A9%EC%85%88_%EB%8F%84%EA%B5%AC_%EC%82%AC%EC%9A%A9_%EC%95%88%EB%82%B4%EC%84%9C.hwpx" } : {}),
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(500);
    response.end();
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`콩셈콩셈 server listening on ${port}`);
});

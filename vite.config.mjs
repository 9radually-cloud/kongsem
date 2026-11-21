import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';

const require = createRequire(import.meta.url);
const { handleActivity, handleChat, handleHealth, handleStudentFirstLogin, handleStudentHistoryDelete, handleStudentLearningPath, handleStudentLog, handleStudentMachineLabAccess, handleStudentSkillProgress, handleSupabaseConfig, handleSupabaseLogin, handleSupabaseSetup, handleTeacherClassroomSettings, handleTeacherRoster, handleTeacherRosterBulk } = require('./api-handler.cjs');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (!process.env.UPSTAGE_API_KEY && env.UPSTAGE_API_KEY) {
    process.env.UPSTAGE_API_KEY = env.UPSTAGE_API_KEY;
  }
  if (!process.env.SUPABASE_URL && env.SUPABASE_URL) process.env.SUPABASE_URL = env.SUPABASE_URL;
  if (!process.env.SUPABASE_ANON_KEY && env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    build: {
      rollupOptions: {
        input: [resolve(process.cwd(), 'index.html'), resolve(process.cwd(), 'teacher-presentation.html')],
      },
    },
    server: { host: '0.0.0.0', port: 3000, strictPort: true },
    plugins: [{
      name: 'upstage-chat-proxy',
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const pathname = new URL(request.url || '/', 'http://localhost').pathname;
          if (decodeURIComponent(pathname) === '/콩셈콩셈_도구_사용_안내서.hwpx' && request.method === 'GET') {
            const document = await readFile(resolve(process.cwd(), 'public/콩셈콩셈_도구_사용_안내서.hwpx'));
            response.writeHead(200, {
              'Content-Type': 'application/octet-stream',
              'Content-Disposition': "attachment; filename*=UTF-8''%EC%BD%A9%EC%85%88%EC%BD%A9%EC%85%88_%EB%8F%84%EA%B5%AC_%EC%82%AC%EC%9A%A9_%EC%95%88%EB%82%B4%EC%84%9C.hwpx",
              'Content-Length': document.length,
              'Cache-Control': 'no-cache',
            });
            response.end(document);
            return;
          }
          if (pathname === '/api/supabase-config' && request.method === 'GET') {
            handleSupabaseConfig(request, response);
            return;
          }
          if (pathname === '/api/supabase-setup' && request.method === 'GET') {
            await handleSupabaseSetup(request, response);
            return;
          }
          if (pathname === '/api/supabase-login' && request.method === 'POST') {
            await handleSupabaseLogin(request, response);
            return;
          }
          if (pathname === '/api/student/first-login' && request.method === 'POST') {
            await handleStudentFirstLogin(request, response);
            return;
          }
          if (pathname === '/api/student/skill-progress' && ['GET', 'POST'].includes(request.method)) {
            await handleStudentSkillProgress(request, response);
            return;
          }
          if (pathname === '/api/student/history' && request.method === 'DELETE') {
            await handleStudentHistoryDelete(request, response);
            return;
          }
          if (pathname === '/api/student/learning-path' && ['GET', 'POST'].includes(request.method)) {
            await handleStudentLearningPath(request, response);
            return;
          }
          if (pathname === '/api/teacher/roster' && ['GET', 'POST'].includes(request.method)) {
            await handleTeacherRoster(request, response);
            return;
          }
          if (pathname === '/api/teacher/roster/bulk' && request.method === 'POST') {
            await handleTeacherRosterBulk(request, response);
            return;
          }
          if (pathname === '/api/teacher/classroom-settings' && ['GET', 'POST'].includes(request.method)) {
            await handleTeacherClassroomSettings(request, response);
            return;
          }
          if (pathname === '/api/student/machine-lab-access' && request.method === 'GET') {
            await handleStudentMachineLabAccess(request, response);
            return;
          }
          if (pathname === '/api/health' && request.method === 'GET') {
            handleHealth(request, response);
            return;
          }
          if (pathname === '/api/activity' && request.method === 'POST') {
            await handleActivity(request, response);
            return;
          }
          if (pathname === '/api/student-log' && request.method === 'POST') {
            await handleStudentLog(request, response);
            return;
          }
          if (pathname !== '/api/chat') {
            next();
            return;
          }
          if (request.method !== 'POST') {
            response.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
            response.end(JSON.stringify({ error: 'POST 요청만 지원해요.' }));
            return;
          }
          await handleChat(request, response);
        });
      },
    }],
  };
});

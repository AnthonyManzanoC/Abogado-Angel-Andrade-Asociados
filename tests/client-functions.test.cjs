const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto').webcrypto;
const ts=require('../frontend/node_modules/typescript');
const calls=[];
function load(relative){const source=fs.readFileSync(path.join(__dirname,'../frontend',relative),'utf8');const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};vm.runInNewContext(output,{exports,require:()=>({api:async(...args)=>{calls.push(args);return {services:[{id:'familia'}],settings:{address:'Babahoyo'},slots:[]};}}),URL,URLSearchParams,Intl,Date,crypto,AbortController,console,document:{},navigator:{}});return exports;}
(async()=>{
 const tools=load('lib/portal-tools.ts');const embeds=load('lib/embeds.ts');let passed=0;
 function check(actual,expected,label){assert.equal(actual,expected,label);console.log('PASS: '+label);passed++;}
 check(tools.detectIntent('¿Puedo agendar una CITA?'),'appointment','Intención de cita en español');
 check(tools.detectIntent('Necesito defensa penal'),'services','Alma reconoce Derecho Penal');
 check(tools.detectIntent('Quiero consultar mi solicitud'),'track','Seguimiento tiene prioridad sobre consulta');
 check(tools.detectIntent('¿Cuál es la dirección?'),'office','Ubicación con tildes y signos');
 check(tools.detectIntent('¿Cómo cancelar un contrato?'),'services','Una consulta sobre contratos no borra la conversación');
 check(tools.detectIntent('reiniciar'),'reset','Reinicio solo por instrucción explícita');
 check(tools.detectIntent('Quisiera postular al caso gratuito'),'solidarity','Asistente dirige el apoyo gratuito a la convocatoria privada');
 const a=tools.credentials(),b=tools.credentials();assert.notEqual(a.trackingToken,b.trackingToken);check(a.trackingToken.length,64,'Clave privada aleatoria de 256 bits');
 check(new URL('https://portal.test'+tools.trackingLink('AA-123456789012',a.trackingToken)).search,'','La clave de seguimiento no viaja en query string');
 check(embeds.embedUrl('instagram','https://instagram.com.evil.test/reel/abc123/'),null,'Host suplantado bloqueado');
 check(embeds.embedUrl('youtube','javascript:alert(1)'),null,'Protocolo ejecutable bloqueado');
 check(embeds.embedUrl('instagram','https://www.instagram.com/reel/abc123/'),'https://www.instagram.com/reel/abc123/embed/','Reel convertido a reproductor seguro');
 check(embeds.embedUrl('youtube','https://youtu.be/abcdefghijk'),'https://www.youtube-nocookie.com/embed/abcdefghijk','YouTube usa reproductor de privacidad mejorada');
 check(embeds.embedUrl('tiktok','https://www.tiktok.com/@sample/video/123456789'),'https://www.tiktok.com/player/v1/123456789','Enlace completo de TikTok admitido');
 check(embeds.embedUrl('linkedin','https://www.linkedin.com/posts/example_activity-123456789-abcd'),'https://www.linkedin.com/embed/feed/update/urn:li:activity:123456789','Publicación de LinkedIn convertida');
 await tools.executePortalTool('create_consultation',{name:'Prueba',consent:true,...a});check(calls.at(-1)[0],'/requests','Asistente y formulario comparten API de solicitudes');
 await assert.rejects(()=>tools.executePortalTool('delete_everything',{}));passed++;console.log('PASS: Herramientas fuera de catálogo rechazadas');
 tools.registerWebMCP()();passed++;console.log('PASS: Navegador sin WebMCP mantiene el funcionamiento');
 console.log('\n'+passed+' verificaciones de funciones del cliente completadas.');
})().catch(e=>{console.error(e);process.exit(1);});

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const root=process.cwd();
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const relative=pathname.replace(/^\/Quo\//,'');
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try {
    let content=fs.readFileSync(file);
    if(relative==='index.html') {
      content=content.toString().replace(/<script src="https:[^"]*supabase[^"\n]*"><\/script>/,'<script src="./tests/fixtures/supabase-stub.js"></script>')
        .replace(/<script src="https:[^"]*(?:html2canvas|jspdf)[^"\n]*"><\/script>/g,'')
        .replace('</head>','<script src="./tests/fixtures/browser-checks.js"></script></head>');
    }
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/html');
    res.setHeader('Content-Security-Policy',"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data: blob:");
    res.end(content);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(Number(process.env.QUO_TEST_PORT||4173),'0.0.0.0',()=>console.log('Quo isolated fixture at http://localhost:'+server.address().port+'/Quo/index.html'));

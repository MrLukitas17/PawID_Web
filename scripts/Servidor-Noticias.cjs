// Node 18 o posterior. Servidor local de archivos y noticias, sin dependencias.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const news=require('../api/news.js');const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
http.createServer((req,res)=>{
  let url;try{url=new URL(req.url,'http://localhost');}catch{res.writeHead(400);return res.end();}
  if(url.pathname==='/api/news') return news(req,res);
  let file;try{file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/templates/index.html':url.pathname));}catch{res.writeHead(400);return res.end();}
  if(!file.startsWith(root+path.sep) || !['templates','js','css','img'].includes(path.relative(root,file).split(path.sep)[0])){res.writeHead(403);return res.end();}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);return res.end('No encontrado');}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);});
}).listen(Number(process.env.PORT)||5501,'127.0.0.1',()=>console.log('PawID con noticias: http://localhost:'+(process.env.PORT||5501)));
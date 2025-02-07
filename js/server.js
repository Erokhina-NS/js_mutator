const express = require('express');
const http = require('http');
const mutator = require('./main_mutator');
const printer = require('./ast2code');
const trimmer = require('./trimmer');

const app = express();
const router = express.Router();
const server = http.createServer(app);

app.use(express.urlencoded({extended: true}));
app.use('/', router);
server.listen(8080);


router.post('/node_mutate', function(req, res, next) {
try {
  const resultCode = mutator.MainMutate(req.body.main_path,req.body.file_path);
  res.send(resultCode);
} catch (error) {
  res.send(['','Unsuccess\n']);
}
  return res.end();
});
router.post('/code_print', function(req, res, next) {
    try {
      const resultPath = printer.Ast2Code(req.body.dir_path,req.body.ast_path);
      res.send(resultPath);
    } catch (error) {
      res.send('Unsuccess\n');
    }
      return res.end();
    });
router.post('/trim_code', function(req, res, next) {
    try {
        const resultTrim = trimmer.MainTrim(req.body.dir_path,req.body.code_path);
        res.send(resultTrim);
    } catch (error) {
        res.send('Unsuccess\n');
    }
        return res.end();
    });

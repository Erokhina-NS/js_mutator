const esprima = require('esprima');
const estraverse = require('estraverse');
const escodegen = require('escodegen');
const fs = require('fs');
function traverseAST(node) {
  let nodeList = [];
  let parentNode = null;
  function traverse(node) {
    if (node === null) {
      return;
    }
    nodeList.push(node); // Добавляем текущий узел в список
    for (let key in node) {
      if (typeof node[key] === 'object' && node[key] !== null) {
        parentNode = node;
        traverse(node[key]); // Рекурсивный вызов для обхода дочерних узлов
      }
    }
  }
  traverse(node); // Запускаем обход AST-дерева
  return nodeList;
}

function removeNode(node, parentNode, property) {
  if (parentNode) {
    if (Array.isArray(parentNode[property])) {
      // Удаление из списка узлов
      const index = parentNode[property].indexOf(node);
      if (index !== -1) {
        parentNode[property].splice(index, 1);
      }
    } else {
      // Удаление из свойств объекта
      delete parentNode[property];
    }
  }
}
// Функция для удаления узла из AST-дерева
function removeNodeFromAST(ast, nodeToRemove) {
  estraverse.replace(ast, {
    enter: function(node, parent) {
        if (node == nodeToRemove) {
          if (parent.type == 'FunctionDeclaration') {
            return;
          }
          return estraverse.VisitorOption.Remove;
        } 
    },
    leave: function(node, parent) {
      // Если родительский узел был удален, удалите ссылку на него из родительского узла
      for (let key in node) {
        if (Array.isArray(node[key])) {
          node[key] = node[key].filter(childNode => childNode !== null);
        } else if (node[key] && typeof node[key] === 'object') {
          if (node[key].type === null) {
            delete node[key];
          }
        }
      }
    }
  }); 
}
function countNodes(node) {
  let count = 1; // Начинаем счет с 1, чтобы учесть сам узел
  // Рекурсивно обходим всех потомков узла
  for (const key in node) {
    if (typeof node[key] === "object" && node[key] !== null) {
      count += countNodes(node[key]);
    }
  }
  return count;
}
function read_file(ast_path){
  return fs.readFileSync(ast_path, 'utf8');
}
function toAst(ast_path) {
  ast = read_file(ast_path);
  ast = JSON.parse(ast);
  return ast;
}

let nodeToRemove = {};
function MainTrim(dir_path,js_path){
  try {
    const code = fs.readFileSync(js_path, 'utf8');
    const ast_st = esprima.parse(code);
    let path = js_path.split("/");
    let js_name = path[path.length - 1].replace('.js','');
    const count = countNodes(ast_st);
    let res = {};
    let s = count-1;
    do {
      let ast = JSON.parse(JSON.stringify(ast_st));
      let seq = traverseAST(ast);
      nodeToRemove = seq[s];
      removeNodeFromAST(ast, nodeToRemove);
      if (ast != null) {
        try {
          let code2 = escodegen.generate(ast);
          if (Object.values(res).indexOf(code2) === -1 && code2 !== '' && code2 !== null) {
            let res_path = dir_path+js_name+'_'+String(s)+'.js';
            fs.writeFileSync(res_path, code2);
            res[res_path] = code2;
          }
        }catch (err) {
          s-=1;
          continue;
        }
      }
      s-=1;
    } while (s > 1);
    return Object.keys(res).join('|')+'\n';
} catch (err) {
  err = '[!] Error - ' + String(err) + '\n';
  return err;
}
}
module.exports = {
  MainTrim: MainTrim,
};





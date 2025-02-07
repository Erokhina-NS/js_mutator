// https://esprima.readthedocs.io/en/latest/syntax-tree-format.html - вся инфа по возможным нодам
const esprima = require('esprima');
const escope = require('escope');
const estraverse = require('estraverse');
const escodegen = require('escodegen');
const esquery = require('esquery');
const fs = require('fs');
const CryptoJS = require('crypto-js');
function countNodes(node) {
  let count = 1; // Начинаем счет с 1, чтобы учесть сам узел
  // Рекурсивно обходим всех потомков узла
  for (const key in node) {
    if (typeof node[key] === "object" && node[key] !== null) {
      count += countNodes(node[key]);
    }
  }
  return count;//
}
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}
  /////////////////////1-2//////////////////////////
  const literalNums = [0, 1, 1.00, 1 / 2, 1E2, 1E02, 1E+02, 1E02, +0, +0.0, 0.00, 999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999, 0x0, 0xffffffff, 0xffffffffffffffff, 0xabad1dea, 123456789012345678901234567890123456789, 1000.00, 1000000.00, 1000.00, 100000.000, 100000000, 01000, 08, 09, 2.2250738585072011e-308];
  function mutateExpressions(ast,dataset_dir,trees) {
    let mutationsMade = false;
    estraverse.traverse(ast, {
      enter: function (node, parent) {
        let MutationStratagy = getRandomInt(3);
        switch (node.type) {
          case 'BinaryExpression':
            if (parent.type == 'ForStatement') {
              break;
            }
            const binaryOperator =
              ['+', '-', '*', '/', '%', '**', '&', '|', '^', '<<', '>>', '>>>', 'instanceof', 'in'];
            MutationStratagy = getRandomInt(4); // change only 25%.
            if (MutationStratagy == 0) {
              let pre = node.operator;
              while (node.operator == pre) {
                node.operator = randomChoice(binaryOperator);
              }
              mutationsMade = true;
            }
            break;
          case 'LogicalExpression':
            const logicalOperator = ['&&', '||'];
            MutationStratagy = getRandomInt(4); // change only 25%.
            if (MutationStratagy == 0) {
              let pre = node.operator;
              while (node.operator == pre) {
                node.operator = randomChoice(logicalOperator);
              }
              mutationsMade = true;
            }
            break;
          case 'AssignmentExpression':
            const assignOperator =
              ['+=', '-=', '*=', '**=', '/=', '%=', '&=', '^=', '|=', '<<=', '>>=',
                '>>>=', '='];
            MutationStratagy = getRandomInt(4); // change only 25%.
            if (MutationStratagy == 0) {
              let pre = node.operator;
              while (node.operator == pre) {
                node.operator = randomChoice(assignOperator);
              }
              mutationsMade = true;
            }
            break;
          case 'UnaryExpression':
            const unaryOperator = ['+', '-', '~', '!', 'delete', 'void', 'typeof'];
            MutationStratagy = getRandomInt(4); // change only 25%.
            if (MutationStratagy == 0) {
              let pre = node.operator;
              while (node.operator == pre) {
                node.operator = randomChoice(unaryOperator);
              }
              mutationsMade = true;
            }
            break;
          case 'UpdateExpression':
            const updateOperator = ['++', '--'];
            MutationStratagy = getRandomInt(4); // change only 25%.
            if (MutationStratagy == 0) {
              let pre = node.operator;
              while (node.operator == pre) {
                node.operator = randomChoice(updateOperator);
              }
              mutationsMade = true;
            }
            break;
        }; return node;
      }
    });
    if (mutationsMade) {
      return ast;
    } else {
      return null;
    }
  }
  function mutateValues(ast,dataset_dir,trees) {
    let mutationsMade = false;
    estraverse.replace(ast, {
      enter: function (node, parent) {
        let MutationStratagy = getRandomInt(5);
        if (node.type == 'Literal') {
          switch (typeof node.value) {
            case 'string': 
            if (MutationStratagy == 0) {
              node.value = '';
              mutationsMade = true;
            }
            break;
            case 'number': 
            if (MutationStratagy == 1) {
              node.value = randomChoice(literalNums);
              mutationsMade = true;
            }
            break;
            case 'boolean': 
            if (MutationStratagy == 3) {
              if (node.value == true) {
                node.value = false;
              } else {
                node.value = true;
              }
              mutationsMade = true;
            }
            break;
            case 'null': 
            if (MutationStratagy == 4) {
              node.value = randomChoice([true,false, 0,1,-1,''])
              mutationsMade = true;
            }
          }
        };
        return node;
      }
    });
    if (mutationsMade) {
      return ast;
    } else {
      return null;
    }
  }
  /////////////////////3//////////////////////////
  class SubtreeReplacer {
    constructor(ast,dataset_dir,trees) {
      this.ast = ast;
      this.scopeManager = escope.analyze(this.ast);
  
      // node replacing is an infinite process and we need to break it someday.
      this.mutationFlag = false;
      this.inLoop = false;
      this.inSwitch = false;
  
      // Helps to control variables.
      this.globalVariables = new Map();
      this.functionVariables = new Map();
      this.newNodeVariables = new Map();
      this.isNeedRefreshScopeManager = false;
  
      // we can have nested function declarations and
      // leaving function context not garantee that we left function.
      // [fun_name1, fun_name2], just for debug.
      this.functionStack = [];
      // [map1{}, map2{}],  stores previous scopes to restore scope of wrapper
      this.prevScope = [];
  
      // it collects new objects from sources during mutating.
      this.nodesToInsert = new Map();

      this.dataset_dir = dataset_dir;
      this.trees = trees;
    }
    inFunction() {
      if (this.functionStack.length > 0) {
        return true;
      }
      return false;
    }
    __extractVariableNames(varMap, varArray) {
      for (let i = 0; i < varArray.length; i++) {
        varMap.set(varArray[i].name, 1);
      }
    }
    extractGlobalVariables(varArray) {
      this.__extractVariableNames(this.globalVariables, varArray);
    }
    extractFunctionVariables(varArray) {
      this.__extractVariableNames(this.functionVariables, varArray);
    }
    extractNewNodeVaribles(varArray) {
      this.__extractVariableNames(this.newNodeVariables, varArray);
    }
    freeFunctionVariables() {
      this.functionVariables = this.prevScope.pop();
      if (!this.functionVariables) {
        this.functionVariables = new Map();
      }
  
      this.functionStack.pop();
    }
    freeNewNodeVariables() {
      this.newNodeVariables = new Map();
    }
    freeVariables(varArray) {
      const self = this;
      for (let i = 0; i < varArray.length; i++) {
        self.globalVariables.set(varArray[i].name, 1);
      }
    }
    varExists(name) {
      if (this.globalVariables.get(name)) {
        return true;
      }
      if (this.newNodeVariables.get(name)) {
        return true;
      }
      if (this.functionVariables.get(name)) {
        return true;
      }
      return false;
    }
    randVariableName() {
      const merged = new Map([
        ...this.globalVariables,
        ...this.newNodeVariables,
        ...this.functionVariables,
      ]);
      return randomChoice(Array.from(merged.keys()));
    }
    // it skipes nodes which are not applicable for the current context.

    __nodeIsApplicable(node) {
      const self = this;
      let isApplicable = true;
      estraverse.traverse(node, {
        enter: function(node, parent) {
          switch (node.type) {
            case 'BreakStatement':
              if (!self.inLoop && !self.inSwitch) {
                isApplicable = false;
              };
              break;
            case 'ReturnStatement':
              if (!self.inFunction()) {
                isApplicable = false;
              }
            case 'ContinueStatement':
              if (!self.inLoop) {
                isApplicable = false;
              }
          }
        },
        leave: function(node, parent) {},
      });
      return isApplicable;
    }
    // it gets applicable node for the current context with @aimed_type.
    // if @index is set it will return: all_applicable_nodes_from_ast[index].
    // if @index is not set it will return:
    // all_applicable_nodes_from_ast[random_index].
    __getNode(ast, aimedType, index) {
      const self = this;
      const resNodes = [];
      estraverse.traverse(ast, {
        enter: function(node, parent) {
          if (node.type == aimedType && self.__nodeIsApplicable(node)) {
            resNodes.push(node);
          }
        },
        leave: function(node, parent) {
        },
      });
  
      if (!index) {
        index = Math.floor(Math.random() * resNodes.length);
      };
      return [resNodes[index], ast];
    }
    getNode(aimedType) {
      const self = this;
  
      let treeFile;
      while (true) {
        treeFile = this.dataset_dir + randomChoice(this.trees);
        const code = fs.readFileSync(treeFile, 'utf-8');
        let ast;
        try {
          ast = esprima.parse(code);
        } catch (e) {
          continue;
        }
        const [newNode, sourceTree] = self.__getNode(ast, aimedType);
        if (newNode) {
          return [newNode, sourceTree];
        }
        continue;
      }
    }
    // just for debug. It gets a node from a specified tree
    // with the specified index.
    getSpecifiedNode(treeFile, nodeIndex, aimedType) {
      const self = this;
  
      const code = fs.readFileSync(treeFile, 'utf-8');
      const ast = esprima.parse(code);
  
      return self.__getNode(ast, aimedType, nodeIndex);
    }
    insertNodeFromSource(node, sourceTree, selector) {
      const self = this;
  
      // if the node is in a queue for insertion already, skip it.
      if (self.nodesToInsert.get(node.name)) {
        return;
      }
  
      // add new node from source tree if it doesn't exist in the original ast.
      if (esquery.query(self.ast, selector).length == 0) {
        const nodeFromSource = esquery.query(sourceTree, selector);
        if (nodeFromSource.length > 0) {
          self.nodesToInsert.set(
              node.name,
              {
                node: nodeFromSource[0],
                source: sourceTree,
              },
          );
        }
      }
    }
    prepareNodeForInsertion(newNode, sourceTree) {
      const self = this;
      const sourceScopeManager = escope.analyze(sourceTree);
  
      estraverse.traverse(newNode, {
        enter: function(node, parent) {
          // returns list of variables which are declarated in a node.
          self.extractNewNodeVaribles(
              sourceScopeManager.getDeclaredVariables(node));
  
          if (/Function/.test(node.type)) {
            return; // do not replace function declaration names.
          }
  
          switch (node.name) {
            case 'console': return; // add standard modules here.
            case 'Math': return;
          }
  
          if (parent) {
            // it means we are in a function call.
            // if calling function not in the tree,
            // try to extraxt this node from the source tree.
            if (node.type == 'Identifier' &&
                parent.type == 'CallExpression') {
              self.insertNodeFromSource(
                  node,
                  sourceTree,
                  `[type="FunctionDeclaration"][id.name="${node.name}"]`,
              );
              return; // do not replace function calls.
            }
  
            // we are in `new MyClass()` construction.
            // try to extraxt class definition from the source tres.
            if (node.type == 'Identifier' &&
                parent.type == 'NewExpression') {
              // Skip standard classes. TODO: Add other standard types.
              switch (node.name) {
                case 'Map':
                case 'Set':
                case 'Array': return;
              }
  
              self.insertNodeFromSource(
                  node,
                  sourceTree,
                  `[type="ClassDeclaration"][id.name="${node.name}"]`,
              );
              return; // do not replace `new SomeClass()` constructions.
            }
  
            // `someClass.method`. replace only someClass.
            if (
              node.type == 'Identifier' &&
              parent.type == 'MemberExpression' &&
              node == parent.property &&
              !parent.computed) {
              return; // do not replace property calls.
            }
          }
  
          // And finaly replace the all rest.
          if (node.type == 'Identifier') {
            if (!self.varExists(node.name)) {
              node.name = self.randVariableName();
            };
          }
        },
        leave: function(node, parent) {},
      });
      self.freeNewNodeVariables();
    }
  
    // mutate_blocks replaces blocks:
    // "ForStatement":
    // "ForInStatement":
    // "IfStatement":
    // "DoWhileStatement":
    // "SwitchStatement":
    // "WhileStatement":
    // "WithStatement":
    // "BlockStatement":
    //
    // It queries new block with the same type from the given data-set.
    mutate(idx) {
      const self = this;
      let count = 0;
      estraverse.replace(self.ast, {
        enter: function(node, parent) {
          count++;
          // mutation limit reached, just leave.
          if (self.mutationFlag == true || count > idx) {
            return estraverse.VisitorOption.Break;
          }
  
          if (self.isNeedRefreshScopeManager) {
            self.scopeManager = escope.analyze(self.ast);
            self.isNeedRefreshScopeManager = false;
          }
  
          if (/Function/.test(node.type)) {
            if (node.id) {
              self.functionStack.push(node.id.name);
            } else {
              self.functionStack.push('anon_function');
            }
  
            self.prevScope.push(new Map(self.functionVariables));
          }
  
          // Control new names.
          // If we are in function, add new variable to the function variables.
          // If not, add new variable to the global variables.
          if (self.inFunction()) {
            // skip function names
            if (!/Function/.test(node.type)) {
              self.extractFunctionVariables(
                  self.scopeManager.getDeclaredVariables(node),
              );
            }
          } else {
            self.extractGlobalVariables(
                self.scopeManager.getDeclaredVariables(node),
            );
          }
  
          switch (node.type) {
            case 'DoWhileStatement':
            case 'ForStatement':
            case 'ForInStatement':
            case 'ForOfStatement':
            case 'WhileStatement': self.inLoop = true;
            case 'SwitchStatement': self.isSwitch = true;
            case 'WithStatement': break;
            // skip simple nodes.
            case 'BinaryExpression':
            case 'LogicalExpression':
            case 'AssignmentExpression':
            case 'UnaryExpression':
            case 'UpdateExpression': 
            case 'ReturnStatement':
            case 'Identifier': 
            case 'Literal':
            case 'Program': 
            case 'BreakStatement': 
            case 'ContinueStatement': return;
            default: ;
          }
  
          const MutationStratagy = getRandomInt(6); // mutate not all blocks 
          if (MutationStratagy != 0) {return}
          if (count != idx) {return;}
          const [newNode, sourceTree] = self.getNode(node.type);
  
          self.prepareNodeForInsertion(newNode, sourceTree);
          self.isNeedRefreshScopeManager = true;
          self.mutationFlag = true;
          return newNode;
        },
        leave: function(node, parent) {
          // delete variables which are declarated in function node.
          if (/Function/.test(node.type)) {
            self.freeFunctionVariables();
          }
  
          switch (node.type) {
            case 'DoWhileStatement':
            case 'ForStatement':
            case 'ForInStatement':
            case 'ForOfStatement':
            case 'WhileStatement': self.inLoop = false; break;
            case 'SwitchStatement': self.isSwitch = false; break;
          }
        },
      });
  
      // we do it in the end because we ara in a global context -
      // it means that varriable arrays are empty.
      self.nodesToInsert.forEach(function(value, key, map) {
        self.prepareNodeForInsertion(value.node, value.source);
        self.ast.body.push(value.node);
      });
    }
  
    getRes() {
      try {
        return this.ast;
      } catch (error) {
        return null;
      } 
      
    }
  }
  function mutateCode(ast,dataset_dir,trees) {
    const count = countNodes(ast);
    const idx = getRandomInt(count-1);
    const subtreeReplacer = new SubtreeReplacer(ast,dataset_dir,trees);
    subtreeReplacer.mutate(idx);
    return subtreeReplacer.getRes();
  }
/////////////////////4//////////////////////////
function whileIfSwap(ast,dataset_dir,trees) {
  let flag = 0;
  estraverse.traverse(ast, {
      enter: function (node){
          if(node.type == "IfStatement"){
              flag = 1;
              node.type = "WhileStatement";
              delete node.alternate;
              node.body = node.consequent;
              delete node.consequent;
          }
          if(node.type == "WhileStatement" && flag == 0){
              node.type = "IfStatement";
              node.consequent = node.body;
              delete node.body;
              node.alternate = undefined;
          }
      },
  });
  return ast;
};
/////////////////////5//////////////////////////
function conditionAdd(ast,dataset_dir,trees) {
  let while_code = "while(True){}";
  let if_code = "if(True){}";
  let while_ast = esprima.parse(while_code);
  let if_ast = esprima.parse(if_code);
  estraverse.traverse(while_ast, {
      enter: function (node) {
          if(node.type == "WhileStatement"){
                  while_node = node;
              }
      },
  });
  estraverse.traverse(if_ast, {
      enter: function (node) {
          if(node.type == "IfStatement"){
                  if_node = node;
              }
      },
  });
  estraverse.traverse(ast, {
      enter: function (node) {
        try {
          if(node.type == "VariableDeclarator" ){    
            for(let i = 0; i < node.init.body.body.length; i++){
                random_block_index = Math.floor(Math.random() * node.init.body.body.length);
                if(node.init.body.body[random_block_index].type != "VariableDeclaration"){break;}
            }
            let node_copy = node.init.body.body[random_block_index];
            let node_arr = [while_node, if_node];
            node.init.body.body[random_block_index] = node_arr[Math.floor(Math.random() * node_arr.length)];
            node.init.body.body[random_block_index].test.name = Boolean(Math.round(Math.random()));
            if(node.init.body.body[random_block_index].type == "WhileStatement"){
                node.init.body.body[random_block_index].body.body[0] = node_copy;
            }else{
                node.init.body.body[random_block_index].consequent.body[0] = node_copy;
            }
        }
        } catch (error) {
          return null;
        }
          
      },
  });
  return ast;
};

/////////////////////////////////////////////////
  function MainMutate(main_path,js_path) {
    const dataset_dir = main_path+'data-set/jsc_suc/';
    const code = fs.readFileSync(js_path, 'utf8');
    const ast = esprima.parse(code);
    let cloned_ast = JSON.parse(JSON.stringify(ast));
    const trees = fs.readdirSync(dataset_dir);
    let res_ast = null;
    let count = 0;
    while (count < 50) {
      let MutationStratagy = randomChoice([mutateCode,mutateValues,mutateExpressions,whileIfSwap,conditionAdd]);
      res_ast = MutationStratagy(ast,dataset_dir,trees);
      if (res_ast != null && res_ast != undefined && JSON.stringify(cloned_ast) !== JSON.stringify(res_ast)) {
        try{
          let code2 = escodegen.generate(res_ast);
          if (code2 != undefined && code2 != null ) {
            return [String(MutationStratagy.name),String(code2.replace(/\n/g, " ")) + '\n'];
          } 
        }catch (error) {
          count+=1;
          continue;
        } 
          } 
          count+=1;
          continue;
    }
    return [String(MutationStratagy.name),'Unsuccess\n'];  
    }
    
  module.exports = {
    MainMutate: MainMutate,
  };
  

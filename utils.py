import os
import json
import ujson
import pickle
from hashlib import sha1
from copy import deepcopy
from config import UTILS_PATH
PROP_DICT = {
  'ArrayPattern': ['type', 'elements'],
  'RestElement': ['type', 'argument'],
  'AssignmentPattern': ['type', 'left', 'right'],
  'ObjectPattern': ['type', 'properties'],
  'ThisExpression': ['type'],
  'Identifier': ['type', 'name'],
  'Literal': ['type', 'value', 'raw', 'regex'] ,
  'ArrayExpression': ['type', 'elements'],
  'ObjectExpression': ['type', 'properties'],
  'Property': ['type', 'key', 'computed', 'value', 'kind', 'method', 'shorthand'],
  'FunctionExpression': ['type', 'id', 'params', 'body', 'generator', 'async', 'expression'],
  'ArrowFunctionExpression': ['type', 'id', 'params', 'body', 'generator', 'async', 'expression'],
  'ClassExpression': ['type', 'id', 'superClass', 'body'],
  'ClassBody': ['type', 'body'],
  'MethodDefinition': ['type', 'key', 'computed', 'value', 'kind', 'static'],
  'TaggedTemplateExpression': ['type', 'tag', 'quasi'],
  'TemplateElement': ['type', 'value', 'tail'],
  'TemplateLiteral': ['type', 'quasis', 'expressions'],
  'MemberExpression': ['type', 'computed', 'object', 'property'],
  'Super': ['type'],
  'MetaProperty': ['type', 'meta', 'property'],
  'CallExpression': ['type', 'callee', 'arguments'],
  'NewExpression': ['type', 'callee', 'arguments'],
  'Import': ['type'],
  'SpreadElement': ['type', 'argument'],
  'UpdateExpression': ['type', 'operator', 'argument', 'prefix'],
  'AwaitExpression': ['type', 'argument'],
  'UnaryExpression': ['type', 'operator', 'argument', 'prefix'],
  'BinaryExpression': ['type', 'operator', 'left', 'right'],
  'LogicalExpression': ['type', 'operator', 'left', 'right'],
  'ConditionalExpression': ['type', 'test', 'consequent', 'alternate'],
  'YieldExpression': ['type', 'argument', 'delegate'],
  'AssignmentExpression': ['type', 'operator', 'left', 'right'],
  'SequenceExpression': ['type', 'expressions'],
  'BlockStatement': ['type', 'body'],
  'BreakStatement': ['type', 'label'],
  'ClassDeclaration': ['type', 'id', 'superClass', 'body'],
  'ContinueStatement': ['type', 'label'],
  'DebuggerStatement': ['type'],
  'DoWhileStatement': ['type', 'body', 'test'],
  'EmptyStatement': ['type'],
  'ExpressionStatement': ['type', 'expression', 'directive'],
  'ForStatement': ['type', 'init', 'test', 'update', 'body'],
  'ForInStatement': ['type', 'left', 'right', 'body', 'each'],
  'ForOfStatement': ['type', 'left', 'right', 'body'],
  'FunctionDeclaration': ['type', 'id', 'params', 'body', 'generator', 'async', 'expression'],
  'IfStatement': ['type', 'test', 'consequent', 'alternate'],
  'LabeledStatement': ['type', 'label', 'body'],
  'ReturnStatement': ['type', 'argument'],
  'SwitchStatement': ['type', 'discriminant', 'cases'],
  'SwitchCase': ['type', 'test', 'consequent'],
  'ThrowStatement': ['type', 'argument'],
  'TryStatement': ['type', 'block', 'handler', 'finalizer'],
  'CatchClause': ['type', 'param', 'body'],
  'VariableDeclaration': ['type', 'declarations', 'kind'],
  'VariableDeclarator': ['type', 'id', 'init'],
  'WhileStatement': ['type', 'test', 'body'],
  'WithStatement': ['type', 'object', 'body'],
  'Program': ['type', 'sourceType', 'body'],
  'ImportDeclaration': ['type', 'specifiers', 'source'],
  'ImportSpecifier': ['type', 'local', 'imported'],
  'ExportAllDeclaration': ['type', 'source'],
  'ExportDefaultDeclaration': ['type', 'declaration'],
  'ExportNamedDeclaration': ['type', 'declaration', 'specifiers', 'source'],
  'ExportSpecifier': ['type', 'exported', 'local'],
}
TERM_TYPE = [
  'DebuggerStatement',
  'ThisExpression',
  'Super',
  'EmptyStatement',
  'Import',
]
def is_node_list(node):
    return type(node) == list
def is_single_node(node):
    return (type(node) == dict and
            'type' in node)
def get_node_type(node):
    return node['type']
def prune(node):
  return {'type': get_node_type(node)}
def push(stack, node, parent_idx):
  node_type = get_node_type(node)
  for key in reversed(PROP_DICT[node_type]):
    if key not in node: continue
    child = node[key]

    # If it has a single child
    if (is_single_node(child) and
        get_node_type(child) not in TERM_TYPE):
      frag_type = get_node_type(child)
      frag_info = (parent_idx, frag_type)
      stack.append(frag_info)
    # If it has multiple children
    elif is_node_list(child):
      for _child in reversed(child):
        if (_child is not None and
            get_node_type(_child) not in TERM_TYPE):
          frag_type = get_node_type(_child)
          frag_info = (parent_idx, frag_type)
          stack.append(frag_info)
def make_frags(node, frag_seq, frag_info_seq,
               node_types, stack):
  # Append the node before visiting its children
  frag = dict()
  frag_idx = len(frag_seq)
  frag_seq.append(frag)

  # Push node info into the stack
  if len(stack) > 0:
    frag_info = stack.pop()
    frag_info_seq.append(frag_info)
  push(stack, node, frag_idx)

  node_type = get_node_type(node)
  node_types.add(node_type)

  for key in PROP_DICT[node_type]:
    if key not in node: continue
    child = node[key]

    # If it has a single child
    if (is_single_node(child) and
        get_node_type(child) not in TERM_TYPE):
      frag[key] = prune(child)
      make_frags(child, frag_seq, frag_info_seq,
                 node_types, stack)
    # If it has multiple children
    elif is_node_list(child):
      frag[key] = []
      for _child in child:
        if _child is None:
          frag[key].append(None)
        elif get_node_type(_child) in TERM_TYPE:
          frag[key].append(_child)
        else:
          pruned_child = prune(_child)
          frag[key].append(pruned_child)
          make_frags(_child, frag_seq, frag_info_seq,
                     node_types, stack)
    # If it is a terminal
    else:
      frag[key] = node[key]

  # Append the fragment
  frag_seq[frag_idx] = frag
  return frag

def load_pickle(dpath):
    with open(dpath, 'rb') as f:
        data = pickle.load(f)
    return data
def load_ast(ast_path):
    with open(ast_path, 'r') as f:
        try:
            ast = ujson.load(f)
        except Exception as e:
            dec = json.JSONDecoder()
            f.seek(0, 0)
            ast = f.read()
            ast = dec.decode(ast)
    js_name = os.path.basename(ast_path)[:-2]
    return js_name, ast

def write(file_name, content, mode='wb'):
    with open(file_name, mode) as f:
        if mode == 'wb':
            try:
                f.write(content)
            except Exception as err:
                pass
        else:
            try:
                f.write(str(content)+'\n')
            except Exception as err:
                pass

def write_ast_to_file(ast_path, ast):
    try:
        ast = json.dumps(ast, indent=2)
        try:
            ast = ast.encode('utf-8')
            try:
                write(ast_path, ast)
                return True
            except Exception as err:
                return False
        except Exception as err:
            return False
    except Exception as err:
        return False

def stringify_frag(node):
    str_val = ''
    if 'type' in node:
        node_type = get_node_type(node)
        prop_list = PROP_DICT[node_type]
    else:
        prop_list = sorted(node.keys())

    for key in prop_list:
        if key not in node: continue
        child = node[key]

        # If it has a single child
        if type(child) == dict:
            str_val += '{'
            str_val += stringify_frag(child)
            str_val += '}'
        # If it has multiple children
        elif type(child) == list:
            str_val += '['
            for _child in child:
                if _child is None:
                    str_val += str(None)
                else:
                    str_val += stringify_frag(_child)
            str_val += ']'
        # If it is a terminal
        else:
            str_val += str((key, node[key]))
    return str_val
def hash_frag(frag):
    return hash_val(stringify_frag(frag))
def hash_val(text):
    if type(text) is str:
        text = text.encode('utf-8')
    return sha1(text).hexdigest()
def is_pruned(node):
    keys = node.keys()
    return (len(keys) == 1 and
            'type' in keys and
            get_node_type(node) not in TERM_TYPE)
def frag2idx(frag,new_frag_dict):
    node_type = get_node_type(frag)
    hash_val = hash_frag(frag)
    if hash_val in new_frag_dict:
        return new_frag_dict[hash_val]
    else:
        return new_frag_dict[node_type]

def traverse(frag_list,new_frag_dict, node, frag_seq, stack):
    node_type = get_node_type(node)
    if node_type not in TERM_TYPE:
        parent_idx = frag2idx(node,new_frag_dict)
    else:
        return

    for key in PROP_DICT[node_type]:
        if key not in node: continue
        child = node[key]

        # If it has a single child
        if is_single_node(child):
            if is_pruned(child):
                frag_idx = frag_seq.pop(0)
                if frag_idx == -1:
                    if stack != None:
                        frag_info = (parent_idx,
                                        get_node_type(child))
                        stack.append(frag_info)
                    continue
                frag = idx2frag(frag_idx,frag_list)
                node[key] = frag
            traverse(frag_list,new_frag_dict, node[key], frag_seq, stack)
        # If it has multiple children
        elif is_node_list(child):
            for idx, _child in enumerate(child):
                if _child == None:
                    continue
                elif is_pruned(_child):
                    frag_idx = frag_seq.pop(0)
                    if frag_idx == -1:
                        if stack != None:
                            frag_info = (parent_idx,
                                            get_node_type(_child))
                            stack.append(frag_info)
                        continue
                    frag = idx2frag(frag_idx,frag_list)
                    child[idx] = frag
                traverse(frag_list,new_frag_dict,child[idx], frag_seq, stack)
def build_subtree(new_frag_dict,frag_list,frag_seq, stack=None):
    frag_idx = frag_seq.pop(0)
    root = idx2frag(frag_idx,frag_list)
    traverse(frag_list,new_frag_dict, root, frag_seq, stack)
    return root, frag_seq
def idx2frag(frag_idx,frag_list):
    frag = frag_list[frag_idx]
    frag = deepcopy(frag)
    return frag
def build_seed_tree(frag_seq, idx, new_frag_dict, frag_list):
    # Find subtree to be pruned
    pre_seq = frag_seq[:idx]
    pruned_seq = frag_seq[idx:]
    root, post_seq = build_subtree(new_frag_dict,frag_list,pruned_seq)

    # Build the seed tree
    frags = pre_seq + [-1] + post_seq
    stack = []
    root, _ = build_subtree(new_frag_dict,frag_list,frags, stack)
    try:
        parent_idx, frag_type = stack.pop(0)
        return root, pre_seq, parent_idx, frag_type, pre_seq + [-1] + post_seq
    except Exception:
        return None,None,None,None,None

def push(stack, node,new_frag_dict):
    parent_idx = frag2idx(node,new_frag_dict)
    node_type = get_node_type(node)
    for key in reversed(PROP_DICT[node_type]):
        if key not in node: continue
        child = node[key]

        if (type(child) == dict and
                is_pruned(child)):
            info = (parent_idx, get_node_type(child))
            stack.append(info)
        elif type(child) == list:
            for _child in reversed(child):
                if _child != None and is_pruned(_child):
                    info = (parent_idx, get_node_type(_child))
                    stack.append(info)
def build_ast(node, stack, frag, new_frag_dict):
    node_type = get_node_type(node)
    for key in PROP_DICT[node_type]:
        if key not in node: continue
        child = node[key]
        # If it has a single child
        if is_single_node(child):
            if not is_pruned(child):
                frag = build_ast(child, stack, frag, new_frag_dict)
            # Expand the frag
            elif frag:
                push(stack, frag,new_frag_dict)
                node[key] = frag
                return None
        # If it has multiple children
        elif is_node_list(child):
            for idx, _child in enumerate(child):
                if _child == None:
                    continue
                elif not is_pruned(_child):
                    frag = build_ast(child[idx], stack, frag, new_frag_dict)
                # Expand the frag
                elif frag:
                    push(stack, frag,new_frag_dict)
                    child[idx] = frag
                    return None
    return frag



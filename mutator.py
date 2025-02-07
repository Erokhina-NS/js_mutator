#!/usr/bin/env python3
# encoding: utf-8
import random, os, shutil, requests, json
from utils import build_seed_tree, write, load_pickle,build_ast,write_ast_to_file,hash_frag
from config import DIR_PATH,MAIN_PATH,SHORT_PATH
def init(seed):
    '''
    Called once when AFLFuzz starts up. Used to seed our RNG.

    @type seed: int
    @param seed: A 32-bit random value
    '''
    try:
        shutil.rmtree(DIR_PATH)
    except Exception:
        pass
    write(MAIN_PATH+'HELP.txt','init','w')
    global frag_dict, frag_list, seed_dict, frag_pool, seed_count
    seed_count = 0
    nodes_path = os.path.join(MAIN_PATH+'data-set/','nodes_base.p')
    (seed_dict,frag_list,frag_dict, frag_pool) = load_pickle(nodes_path)

def deinit():
    pass
def Fragments():
    mutated_code = None
    if fname != None and fname in seed_dict.keys():
        try:
            frag_seq, _ = seed_dict[fname]
            idx = random.randint(1, len(frag_seq) - 1)
            (tree, _, _, frag_type, _) = build_seed_tree(frag_seq, idx, frag_dict, frag_list)
            frag = random.choice(frag_pool[frag_type])
            build_ast(tree, [], frag, frag_dict)
            tree_name = hash_frag(tree) + '.json'
            tree_path = os.path.join(MAIN_PATH, tree_name)
            res = write_ast_to_file(tree_path, tree)
            if res:
                r = requests.post("http://127.0.0.1:8080/code_print", data={"dir_path":MAIN_PATH,"ast_path":tree_path})
                js_path = r.text
                try:
                    os.remove(tree_path.strip())
                except Exception as err:
                    write(MAIN_PATH+'HELP.txt','remove err='+str(err),'a')
                js_path = js_path.strip()
                if js_path != b'' and 'Error' not in js_path:
                    with open(js_path, 'r') as f:
                        code = f.read()
                    try:
                        os.remove(js_path)
                    except Exception as err:
                        write(MAIN_PATH+'HELP.txt','remove err2='+str(err),'a')
                    return ['Fragments',code]
                else:
                    return None
            return None
        except Exception as err:
            pass
            return None
    return None
def Node():
    r = requests.post("http://127.0.0.1:8080/node_mutate", data={"main_path":MAIN_PATH, "file_path": SHORT_PATH+file_path})
    res_code = json.loads(r.text)
    if res_code[1].strip() != None and res_code[1].strip() != '' and res_code[1].strip() != ' ' and res_code[1].strip() != 'Unsuccess' and ('<!DOCTYPE html>' not in res_code[1] and 'Error:' not in res_code[1]):
        return res_code
    else:
        return None

def fuzz(buf, add_buf, max_size):
    '''
    Called per fuzzing iteration.

    @type buf: bytearray
    @param buf: The buffer that should be mutated.

    @type add_buf: bytearray
    @param add_buf: A second buffer that can be used as mutation source.

    @type max_size: int
    @param max_size: Maximum size of the mutated output. The mutation must not
        produce data larger than max_size.

    @rtype: bytearray
    @return: A new bytearray containing the mutated data
    '''
    selectedStrategy = random.choice([Fragments,Node,Node,Node])
    count = 0
    while(count < 50):
        mutated_code = selectedStrategy()
        if mutated_code != None:   
            return bytearray(mutated_code[1].encode())
        elif selectedStrategy == Fragments:
            selectedStrategy = Node
        else:
            selectedStrategy = random.choice([Fragments,Node])
        count+=1
    return None
       
def init_trim(buf):
    '''
    Called per trimming iteration.

    @type buf: bytearray
    @param buf: The buffer that should be trimmed.

    @rtype: int
    @return: The maximum number of trimming steps.

    # Initialize global variables
    # Figure out how many trimming steps are possible.
    # If this is not possible for your trimming, you can
    # return 1 instead and always return 0 in post_trim
    # until you are done (then you return 1).
    '''
    global res 
    res = []
    return 1
def trim():
    '''
    Called per trimming iteration.

    @rtype: bytearray
    @return: A new bytearray containing the trimmed data.
    '''
    global file_path, res, r_path
    while True:
        if res == []:
            r = requests.post("http://127.0.0.1:8080/trim_code", data={"dir_path":MAIN_PATH,"code_path":str(SHORT_PATH+file_path)})
            trimmed = r.text.strip()
            if trimmed != '' and 'Error' not in trimmed:
                res = trimmed.split('|')
        if res != []:
            r_path = res.pop(0)
            if r_path != '' and 'Error' not in r_path:
                try:
                    sz = os.path.getsize(r_path)
                    if  sz > 10:
                        with open(r_path, 'r') as f:
                            r_code = f.read()
                        return bytearray(r_code.encode())
                except Exception as err:
                    write(MAIN_PATH+'HELP.txt','trimmer err2='+str(err)+'\n r_path='+str(r_path),'a')
        return bytearray([1])
def post_trim(success):
    '''
    Called after each trimming operation.

    @type success: bool
    @param success: Indicates if the last trim operation was successful.

    @rtype: int
    @return: The next trim index (0 to max number of steps) where max
             number of steps indicates the trimming is done.
    '''
    global res, r_path, file_path
    if success:
        write(MAIN_PATH+'HELP.txt','success='+str(success)+'\n r_path='+str(r_path),'a')
    try:
        os.remove(r_path)
    except Exception as err:
        pass
    if res != []:
        return 0
    else:
        return 1

def post_process(buf):
    '''
    Called just before the execution to write the test case in the format
    expected by the target

    @type buf: bytearray
    @param buf: The buffer containing the test case to be executed

    @rtype: bytearray
    @return: The buffer containing the test case after
    '''
    global file_path
    try:
        if buf != bytearray([1]) and buf != None and buf != bytearray([]):
            return buf
        else:
            return ''.encode()
    except Exception as err:
        write(MAIN_PATH+'HELP.txt','post_process err='+str(err),'a')
        return ''.encode()
def queue_get(filename):
    '''
    Called at the beginning of each fuzz iteration to determine whether the
    test case should be fuzzed

    @type filename: str
    @param filename: File name of the test case in the current queue entry

    @rtype: bool
    @return: Return True if the custom mutator decides to fuzz the test case,
        and False otherwise
    '''
    global fname,file_path
    file_path = filename
    if '+cov' not in filename or 'pos:' not in filename:
        try:
            fname = filename.split(':')[4]
            if ',' in fname:
                fname = None
        except Exception:
            fname = None
    else:   
        fname = None
    return True
def queue_new_entry(filename_new_queue, filename_orig_queue):
    '''
    Called after adding a new test case to the queue

    @type filename_new_queue: str
    @param filename_new_queue: File name of the new queue entry

    @type filename_orig_queue: str
    @param filename_orig_queue: File name of the original queue entry
    '''
    global file_path, seed_count
    file_path = filename_new_queue
    if filename_orig_queue != None:
        if filename_new_queue != filename_orig_queue:
            return True
    else:
        return True


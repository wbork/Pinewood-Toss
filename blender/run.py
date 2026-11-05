"""
run.py — runs one of the build scripts in this folder and writes <name>_log.txt next to
it, ending with DONE or FAILED (plus the error). Blender started from the Microsoft Store
alias doesn't show its console output, so this log is how you see what happened.

  blender-launcher --background --factory-startup --python blender\\run.py -- build_ranger
"""
import os, sys, runpy, traceback

HERE = os.path.dirname(os.path.abspath(__file__))
name = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'build_ranger'
log_path = os.path.join(HERE, name + '_log.txt')
with open(log_path, 'w', encoding='utf-8') as f:
    f.write('running %s.py\n' % name)
try:
    g = runpy.run_path(os.path.join(HERE, name + '.py'), run_name='__main__')
    with open(log_path, 'a', encoding='utf-8') as f:
        f.write('DONE\n')
except Exception:
    with open(log_path, 'a', encoding='utf-8') as f:
        f.write(traceback.format_exc() + '\nFAILED\n')

@echo off
rem Export a model you edited in Blender to the game: export_model.cmd ranger
rem (reads blender\<name>.blend, writes js\models\<name>.js; see blender\export_log.txt)
set NAME=%~1
if "%NAME%"=="" set NAME=ranger
blender-launcher --background "%~dp0%NAME%.blend" --python "%~dp0pinewood_export.py" -- %NAME%
echo Exporting %NAME% in the background. Check blender\export_log.txt for DONE.

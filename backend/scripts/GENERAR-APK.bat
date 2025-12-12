@echo off
REM Script para generar APK de PetAlert
REM Uso: GENERAR-APK.bat

title Generador de APK - PetAlert

echo =====================================
echo   Generador de APK - PetAlert App
echo =====================================
echo.

REM Verificar si Node.js esta instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no esta instalado
    echo Por favor instala Node.js desde https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js detectado
echo.

REM Verificar si EAS CLI esta instalado
where eas >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ADVERTENCIA] EAS CLI no esta instalado
    echo.
    set /p install="Deseas instalar EAS CLI ahora? (S/N): "
    if /i "%install%"=="S" (
        echo Instalando EAS CLI...
        call npm install -g eas-cli
        if %ERRORLEVEL% NEQ 0 (
            echo [ERROR] Fallo la instalacion de EAS CLI
            pause
            exit /b 1
        )
        echo [OK] EAS CLI instalado correctamente
    ) else (
        echo.
        echo Necesitas EAS CLI para continuar.
        echo Ejecuta: npm install -g eas-cli
        pause
        exit /b 1
    )
)

echo [OK] EAS CLI detectado
echo.

REM Menu de opciones
:menu
echo =====================================
echo   Selecciona el tipo de build:
echo =====================================
echo.
echo 1. Preview (APK para pruebas) [RECOMENDADO]
echo 2. Production (AAB para Google Play)
echo 3. Development (Build rapido local)
echo 4. Local (Build en tu PC)
echo 5. Ver guia completa
echo 6. Salir
echo.
set /p opcion="Selecciona una opcion (1-6): "

if "%opcion%"=="1" goto preview
if "%opcion%"=="2" goto production
if "%opcion%"=="3" goto development
if "%opcion%"=="4" goto local
if "%opcion%"=="5" goto guia
if "%opcion%"=="6" goto fin
echo.
echo [ERROR] Opcion invalida
echo.
goto menu

:preview
echo.
echo =====================================
echo   Build Preview (APK para pruebas)
echo =====================================
echo.
echo Este build generara un APK que puedes instalar directamente
echo en dispositivos Android para testing.
echo.
set /p continuar="Continuar? (S/N): "
if /i not "%continuar%"=="S" goto menu
echo.
echo Iniciando build...
echo.
call eas build --platform android --profile preview
goto resultado

:production
echo.
echo =====================================
echo   Build Production (AAB para Store)
echo =====================================
echo.
echo Este build generara un AAB optimizado para subir a
echo Google Play Store.
echo.
echo IMPORTANTE: Asegurate de haber actualizado la version
echo en app.json antes de continuar.
echo.
set /p continuar="Continuar? (S/N): "
if /i not "%continuar%"=="S" goto menu
echo.
echo Iniciando build...
echo.
call eas build --platform android --profile production
goto resultado

:development
echo.
echo =====================================
echo   Build Development (Rapido)
echo =====================================
echo.
echo Este build es mas rapido y util para desarrollo.
echo Requiere tener un emulador o dispositivo conectado.
echo.
set /p continuar="Continuar? (S/N): "
if /i not "%continuar%"=="S" goto menu
echo.
echo Iniciando build...
echo.
call npx expo run:android
goto resultado

:local
echo.
echo =====================================
echo   Build Local
echo =====================================
echo.
echo Este build se ejecutara en tu computadora.
echo.
echo REQUISITOS:
echo - Android Studio instalado
echo - ANDROID_HOME configurado
echo - Docker instalado (opcional)
echo.
set /p continuar="Continuar? (S/N): "
if /i not "%continuar%"=="S" goto menu
echo.
echo Iniciando build local...
echo.
call eas build --platform android --profile preview --local
goto resultado

:guia
echo.
echo Abriendo guia completa...
start GUIA-GENERAR-APK.md
echo.
goto menu

:resultado
echo.
if %ERRORLEVEL% EQU 0 (
    echo =====================================
    echo   [EXITO] Build completado!
    echo =====================================
    echo.
    echo Para ver y descargar tu build:
    echo 1. Ejecuta: eas build:list
    echo 2. O visita: https://expo.dev
    echo.
) else (
    echo =====================================
    echo   [ERROR] Build fallido
    echo =====================================
    echo.
    echo Revisa los logs arriba para mas detalles.
    echo Consulta GUIA-GENERAR-APK.md para solucion de problemas.
    echo.
)

set /p otro="Deseas generar otro build? (S/N): "
if /i "%otro%"=="S" goto menu
goto fin

:fin
echo.
echo Gracias por usar el generador de APK de PetAlert!
echo.
pause



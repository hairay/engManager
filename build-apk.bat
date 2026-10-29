@echo off
setlocal enabledelayedexpansion

:: 1. Detect / Configure JAVA_HOME (Capacitor 8 / Android 16 requires JDK 21+)
set "FOUND_JDK21="
if exist "%USERPROFILE%\android-dev\jdk-21.0.12+8" (
    set "FOUND_JDK21=%USERPROFILE%\android-dev\jdk-21.0.12+8"
) else if exist "C:\Program Files\Android\Android Studio\jbr" (
    set "FOUND_JDK21=C:\Program Files\Android\Android Studio\jbr"
) else if exist "C:\Program Files\Java\jdk-21" (
    set "FOUND_JDK21=C:\Program Files\Java\jdk-21"
) else if exist "C:\Program Files\Eclipse Adoptium\jdk-21" (
    set "FOUND_JDK21=C:\Program Files\Eclipse Adoptium\jdk-21"
)

if not "!FOUND_JDK21!"=="" (
    set "JAVA_HOME=!FOUND_JDK21!"
    echo [INFO] Using JDK 21 at: !JAVA_HOME!
    set "PATH=!JAVA_HOME!\bin;%PATH%"
) else (
    if not "%JAVA_HOME%"=="" (
        echo [INFO] Using existing JAVA_HOME: %JAVA_HOME%
        set "PATH=%JAVA_HOME%\bin;%PATH%"
    ) else (
        echo [WARNING] JDK 21 path not detected. Relying on default system Java...
    )
)

:: 2. Detect / Configure ANDROID_HOME
if "%ANDROID_HOME%"=="" (
    if exist "%USERPROFILE%\android-dev\android-sdk" (
        set "ANDROID_HOME=%USERPROFILE%\android-dev\android-sdk"
    ) else if exist "%LOCALAPPDATA%\Android\Sdk" (
        set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
    )
)

if "%ANDROID_HOME%"=="" (
    echo [WARNING] ANDROID_HOME not set. Build will rely on local SDK path in android/local.properties.
) else (
    echo [INFO] Using ANDROID_HOME: %ANDROID_HOME%
)

:: 3. Build Web Assets
echo [1/3] Building Web Assets...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Web build failed.
    exit /b %errorlevel%
)

:: 4. Sync Capacitor Native Project (generate android/ on first run)
echo [2/3] Syncing Capacitor Android Project...
if not exist android (
    call npx cap add android
)
call npx cap sync android
if %errorlevel% neq 0 (
    echo [ERROR] Capacitor sync failed.
    exit /b %errorlevel%
)

:: 5. Compile Android APK via Gradle
echo [3/3] Compiling Android APK with Gradle...
cd android
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    cd ..
    echo [ERROR] Gradle build failed.
    exit /b 1
)
cd ..

:: 6. Copy Output Artifact
if not exist dist-apk mkdir dist-apk
copy /y android\app\build\outputs\apk\debug\app-debug.apk dist-apk\EngManager.apk
echo [SUCCESS] EngManager Android APK successfully generated at dist-apk\EngManager.apk!

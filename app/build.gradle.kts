plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "kr.realtor.ox"
    compileSdk = 36
    defaultConfig {
        applicationId = "kr.realtor.ox"
        minSdk = 24
        targetSdk = 35
        versionCode = (System.getenv("VCODE") ?: "1").toInt()
        versionName = "1." + (System.getenv("VCODE") ?: "1")
    }
    signingConfigs {
        create("rel") {
            // 새 서명 열쇠는 GitHub 비밀값(OX_KS, OX_KS_PW)에만 있어요. 없으면 예전 열쇠로.
            val ks = System.getenv("OX_KS_PATH"); val pw = System.getenv("OX_KS_PW")
            if (!ks.isNullOrBlank() && !pw.isNullOrBlank() && file(ks).exists()) { storeFile = file(ks); storePassword = pw; keyAlias = "ox"; keyPassword = pw }
            else { storeFile = rootProject.file("keystore/release.jks"); storePassword = "realtorox"; keyAlias = "ox"; keyPassword = "realtorox" }
        }
    }
    // side = 지금처럼 APK로 직접 설치(앱이 스스로 업데이트) · play = 플레이스토어용(업데이트는 플레이스토어가)
    flavorDimensions += "dist"
    productFlavors {
        create("side") { dimension = "dist"; buildConfigField("boolean", "PLAY", "false") }
        create("play") { dimension = "dist"; targetSdk = 36; buildConfigField("boolean", "PLAY", "true") }
    }
    buildFeatures { buildConfig = true }
    buildTypes {
        release { isMinifyEnabled = false; signingConfig = signingConfigs.getByName("rel") }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    lint { checkReleaseBuilds = false; abortOnError = false }
    androidResources { noCompress += listOf("ogg", "json") }
}
dependencies {
    implementation("androidx.media3:media3-exoplayer:1.5.1")
    implementation("androidx.core:core-ktx:1.13.1")
}

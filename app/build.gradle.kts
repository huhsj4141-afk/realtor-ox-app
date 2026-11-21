plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "kr.realtor.ox"
    compileSdk = 35
    defaultConfig {
        applicationId = "kr.realtor.ox"
        minSdk = 24
        targetSdk = 35
        versionCode = (System.getenv("VCODE") ?: "1").toInt()
        versionName = "1." + (System.getenv("VCODE") ?: "1")
    }
    signingConfigs {
        create("rel") {
            storeFile = rootProject.file("keystore/release.jks")
            storePassword = "realtorox"; keyAlias = "ox"; keyPassword = "realtorox"
        }
    }
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

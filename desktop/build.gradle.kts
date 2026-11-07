plugins {
    kotlin("jvm") version "1.9.24"
    application
    id("org.openjfx.javafxplugin") version "0.1.0"
    id("org.beryx.jlink") version "3.0.1"
}

repositories { mavenCentral() }

kotlin { jvmToolchain(17) }

javafx {
    version = "21"
    modules = listOf("javafx.controls", "javafx.web")
}

application {
    mainClass.set("MainKt")
}

jlink {
    imageName.set("Nijatva")
    launcher { name = "nijatva" }
    jpackage {
        imageName = "Nijatva"
        installerName = "Nijatva"
        appVersion = "2.0.2"
        vendor = "Vasudev"
        skipInstaller = false
    }
}

dependencies {
    implementation(kotlin("stdlib"))
}

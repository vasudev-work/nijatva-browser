plugins {
    kotlin("jvm") version "1.9.24"
    application
    id("org.openjfx.javafxplugin") version "0.1.0"
}

repositories { mavenCentral() }

kotlin { jvmToolchain(17) }

javafx {
    version = "21"
    modules = listOf("javafx.controls", "javafx.web")
}

application { mainClass.set("MainKt") }

dependencies { implementation(kotlin("stdlib")) }

// ---------------------------------------------------------------------------
// Packaging.
//
// jlink wants a modular project, and this one is not - so jpackage is called
// directly on a folder holding the app jar and its dependencies. The installer
// type follows the host: msi on Windows, dmg on macOS, deb on Linux. If the
// installer step fails on a runner that lacks the tooling, a plain app-image is
// produced instead, which still runs.
// ---------------------------------------------------------------------------
val jpackageInput = layout.buildDirectory.dir("jpackage-input")
val jpackageOut = layout.buildDirectory.dir("jpackage")

val stageJars by tasks.registering(Sync::class) {
    dependsOn(tasks.jar)
    from(tasks.jar)
    from(configurations.runtimeClasspath)
    into(jpackageInput)
}

val packageApp by tasks.registering {
    group = "distribution"
    description = "Builds a desktop package for this host"
    dependsOn(stageJars)

    doLast {
        val os = System.getProperty("os.name").lowercase()
        val type = when {
            os.contains("win") -> "msi"
            os.contains("mac") -> "dmg"
            else -> "deb"
        }
        val jpackage = File(System.getProperty("java.home"), "bin/jpackage").absolutePath
        val out = jpackageOut.get().asFile.apply { mkdirs() }
        val jarName = tasks.jar.get().archiveFileName.get()

        fun run(vararg extra: String): Boolean {
            val cmd = mutableListOf(
                jpackage, "--name", "Nijatva", "--app-version", "2.0.2",
                "--input", jpackageInput.get().asFile.absolutePath,
                "--main-jar", jarName, "--main-class", "MainKt",
                "--dest", out.absolutePath
            )
            cmd += extra
            println("running: " + cmd.joinToString(" "))
            return try {
                ProcessBuilder(cmd).inheritIO().start().waitFor() == 0
            } catch (e: Exception) {
                println("jpackage failed: ${e.message}")
                false
            }
        }

        val ok = run("--type", type, "--vendor", "Vasudev", "--description", "Nijatva browser")
        if (!ok) {
            println("installer failed on this runner, building a plain app image instead")
            run("--type", "app-image")
        }
    }
}

# WebView JS bridges are reached by name from JavaScript.
-keepclassmembers class in.nijatva.browser.** {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class in.nijatva.browser.**$$JsBridge { *; }
-keepattributes JavascriptInterface
-keepattributes *Annotation*

package `in`.nijatva.browser

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.webkit.JavascriptInterface
import android.webkit.WebView
import java.lang.ref.WeakReference
import java.util.Locale

/**
 * Android WebView does not implement the Web Speech API, so any page that calls
 * window.speechSynthesis.speak() fails with "Speech synthesis not supported".
 * This bridge stands in for it: the shim in [SHIM] installs a speechSynthesis
 * object in the page, and every call comes here to the device's own TTS engine.
 *
 * The real end-of-speech callback is passed back into the page, so scripts that
 * chain utterances (read the next paragraph when this one finishes) behave.
 */
class SpeechBridge(webView: WebView) {

    private val view = WeakReference(webView)
    private var tts: TextToSpeech? = null
    private var started = false
    private var failed = false
    private var pending: String? = null

    private fun attach() {
        if (tts != null) return
        try {
            tts = TextToSpeech(view.get()?.context ?: return) { status ->
                started = status == TextToSpeech.SUCCESS
                failed = !started
                if (started) {
                    try {
                        tts?.language = Locale.getDefault()
                        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                            override fun onStart(id: String?) { }
                            override fun onError(id: String?) { finish(false) }
                            override fun onDone(id: String?) { finish(true) }
                        })
                    } catch (_: Exception) { }
                    pending?.let { say(it, "", 1f, 1f) }
                    pending = null
                }
            }
        } catch (_: Exception) { failed = true }
    }

    private fun finish(ok: Boolean) {
        try {
            view.get()?.post {
                try {
                    view.get()?.evaluateJavascript(
                        "window.__nijatvaSpeechDone&&window.__nijatvaSpeechDone(" + ok + ")", null)
                } catch (_: Exception) { }
            }
        } catch (_: Exception) { }
    }

    private fun say(text: String, lang: String, rate: Float, pitch: Float) {
        if (text.isBlank() || tts == null) return
        try {
            if (lang.isNotBlank()) {
                val l = Locale.forLanguageTag(lang)
                if (tts?.isLanguageAvailable(l) == TextToSpeech.LANG_AVAILABLE) tts?.language = l
            }
            tts?.setSpeechRate(if (rate in 0.2f..4f) rate else 1f)
            tts?.setPitch(if (pitch in 0.2f..4f) pitch else 1f)
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "nijatva-web")
        } catch (_: Exception) { }
    }

    @JavascriptInterface
    fun speak(text: String?, lang: String?, rate: Double, pitch: Double) {
        val t = text ?: return
        attach()
        if (failed) { finish(false); return }
        if (!started) { pending = t; return }
        say(t, lang ?: "", rate.toFloat(), pitch.toFloat())
    }

    @JavascriptInterface
    fun stop() { try { tts?.stop() } catch (_: Exception) { } }

    @JavascriptInterface
    fun pause() { try { tts?.stop() } catch (_: Exception) { } }

    @JavascriptInterface
    fun resume() { }

    companion object {
        /**
         * Installs a stand-in speechSynthesis. Injected at page start, before the
         * page's own scripts run, so feature detection sees it.
         */
        val SHIM: String = """
(function(){
  try{
    if (window.speechSynthesis && window.speechSynthesis.speak && !window.speechSynthesis.__nijatva) return;
    var B = window.NijatvaSpeech;
    if (!B) return;
    function U(t){
      this.text = t || ''; this.lang = ''; this.rate = 1; this.pitch = 1; this.volume = 1;
      this.onstart = null; this.onend = null; this.onerror = null;
      this.onpause = null; this.onresume = null; this.onboundary = null;
    }
    if (!window.SpeechSynthesisUtterance) window.SpeechSynthesisUtterance = U;
    var voices = [{name:'Nijatva', lang:(navigator.language||'en'), localService:true,
                   'default':true, voiceURI:'nijatva', voice:true}];
    var cur = null;
    var S = {
      __nijatva: true,
      speaking: false, pending: false, paused: false, onvoiceschanged: null,
      speak: function(u){
        try{
          var txt = (u && u.text) || '';
          if (!txt) return;
          cur = u;
          B.speak(txt, (u && u.lang) || '', (u && u.rate) || 1, (u && u.pitch) || 1);
          S.speaking = true; S.paused = false; S.pending = false;
          if (u && u.onstart) setTimeout(function(){ try{ u.onstart({}) }catch(e){} }, 0);
        }catch(e){}
      },
      cancel: function(){ try{ B.stop() }catch(e){} S.speaking = false; cur = null; },
      pause: function(){ try{ B.pause() }catch(e){} S.paused = true; },
      resume: function(){ try{ B.resume() }catch(e){} S.paused = false; },
      getVoices: function(){ return voices; },
      addEventListener: function(){}, removeEventListener: function(){}
    };
    window.__nijatvaSpeechDone = function(ok){
      S.speaking = false;
      try{
        if (cur && ok && cur.onend) cur.onend({});
        if (cur && !ok && cur.onerror) cur.onerror({error:'synthesis-failed'});
      }catch(e){}
    };
    try { Object.defineProperty(window, 'speechSynthesis', {value:S, configurable:true}); }
    catch(e){ window.speechSynthesis = S; }
  }catch(e){}
})();
""".trimIndent()
    }
}

package kr.realtor.ox

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.view.KeyEvent

/** 앱이 꺼져 있을 때 리모컨 버튼 → 듣기 준비 (가운데 = 바로 재생) */
class ButtonReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, i: Intent) {
        val ev: KeyEvent = (if (Build.VERSION.SDK_INT >= 33) i.getParcelableExtra(Intent.EXTRA_KEY_EVENT, KeyEvent::class.java)
            else @Suppress("DEPRECATION") i.getParcelableExtra(Intent.EXTRA_KEY_EVENT)) ?: return
        if (ev.action != KeyEvent.ACTION_DOWN || ev.repeatCount != 0) return
        PlayerService.inst?.let { it.handleKey(ev); return }
        val s = Intent(ctx, PlayerService::class.java).setAction("WAKE").putExtra("slot", Remote.KEYS[ev.keyCode] ?: "")
        try { if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(s) else ctx.startService(s) } catch (e: Exception) { }
    }
}

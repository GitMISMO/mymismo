package org.mismo.mymismo;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.net.wifi.WifiNetworkSuggestion;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.Toast;
import java.util.ArrayList;

/* MyMISMO's Join Wi-Fi button (Jonna, Nov 25, 2026). The app's page opens mymismo://wifi?ssid=...&pass=...; this hands
 * the summit network to Android's own Add Network screen (Android 11 and up), where the person taps Save. Older phones
 * get the password copied and their Wi-Fi settings opened. Android always asks the person first. */
public class WifiJoinActivity extends Activity {
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        Uri u = getIntent() != null ? getIntent().getData() : null;
        String ssid = u != null ? u.getQueryParameter("ssid") : null, pass = u != null ? u.getQueryParameter("pass") : null;
        if (ssid == null || ssid.isEmpty() || ssid.length() > 32) { finish(); return; }
        try {
            if (Build.VERSION.SDK_INT >= 30) {
                WifiNetworkSuggestion.Builder b = new WifiNetworkSuggestion.Builder().setSsid(ssid);
                if (pass != null && pass.length() >= 8) b.setWpa2Passphrase(pass);
                ArrayList<WifiNetworkSuggestion> list = new ArrayList<>();
                list.add(b.build());
                Bundle extras = new Bundle();
                extras.putParcelableArrayList(Settings.EXTRA_WIFI_NETWORK_LIST, list);
                Intent add = new Intent(Settings.ACTION_WIFI_ADD_NETWORKS);
                add.putExtras(extras);
                startActivityForResult(add, 1);
                return;
            }
        } catch (Exception e) { /* fall through to the older way */ }
        if (pass != null && !pass.isEmpty()) {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Wi-Fi password", pass));
            Toast.makeText(this, "Password copied. Pick " + ssid + " and paste it.", Toast.LENGTH_LONG).show();
        }
        try { startActivity(new Intent(Settings.ACTION_WIFI_SETTINGS)); } catch (Exception e) { }
        finish();
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (result == RESULT_OK) Toast.makeText(this, "Wi-Fi saved. Your phone joins it when it's in range.", Toast.LENGTH_LONG).show();
        finish();
    }
}

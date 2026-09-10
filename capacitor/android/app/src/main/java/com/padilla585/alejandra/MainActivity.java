package com.padilla585.alejandra;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ReplanteoARPlugin.class);  // F3 — módulo AR nativo
        super.onCreate(savedInstanceState);
    }
}

package com.ohav.hebcal;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // רישום הפלאגין המקומי חייב לקרות לפני ש-BridgeActivity מרימה את הגשר
        registerPlugin(HebWidgetsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, Rect, Mask, Ellipse } from 'react-native-svg';

export function FaceMaskOverlay() {
  return (
    // pointerEvents="none" is critical so the overlay doesn't block UI touches
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg height="100%" width="100%">
        <Defs>
          <Mask id="face-hole">
            {/* Everything white is visible, everything black is punched out */}
            <Rect x="0" y="0" width="100%" height="100%" fill="white" />
            
            {/* The face oval cutout. Placed slightly above center (cy="45%") */}
            <Ellipse cx="50%" cy="45%" rx="120" ry="160" fill="black" />
          </Mask>
        </Defs>

        {/* The dark overlay background */}
        <Rect 
          x="0" 
          y="0" 
          width="100%" 
          height="100%" 
          fill="rgba(0, 0, 0, 0.6)" 
          mask="url(#face-hole)" 
        />
        
        {/* Optional: A subtle dashed border around the cutout to guide the user */}
        <Ellipse 
          cx="50%" 
          cy="45%" 
          rx="120" 
          ry="160" 
          fill="transparent" 
          stroke="rgba(255, 255, 255, 0.5)" 
          strokeWidth="2" 
          strokeDasharray="8, 8" 
        />
      </Svg>
    </View>
  );
}
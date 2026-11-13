/*
 Yurif | Grove GSR Sensor + Arduino Uno R3
 Base Shield V2: connect GSR to A0, set shield switch to 5V for Uno.
 One averaged RAW ADC reading (0..1023) per line at 9600 baud.
 These are not calibrated skin-conductance values (uS).
*/
const byte GSR_PIN = A0;
void setup(){ Serial.begin(9600); }
void loop(){
  long sum=0;
  for(int i=0;i<10;i++){sum+=analogRead(GSR_PIN);delay(5);}
  Serial.println(sum/10);
  delay(150);
}

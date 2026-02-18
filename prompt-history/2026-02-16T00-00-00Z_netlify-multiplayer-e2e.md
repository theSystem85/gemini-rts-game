2026-02-16T00:00:00Z
GitHub Copilot

I want you now to write an e2e test using the "netlify dev" setup with playwright to simulate 4 player multiplayer game session were the host brower invites to more client browsers and the last party is played by the local AI. Ensure for each party to build a power plant, refinery, vehicle factory, 2 harvesters and one tank each for every party. Then let each party attack the tank of another party. Check if all of the parties actually get new money when harvesters bring back ore to the refinery. Check if the moving units are getting correctly synced on each others map. Check if the attacking (flying projectiles and destroyed units) also gets synced correctly for all players by checking each individual browser. Let me know if you have more questions before you start the test implementation. Make sure to test the simulated game on a map that is just 25x25 tiles to increase the speed of the test setup.

Start implementation
2025-11-24T16-33-49Z
LLM: copilot

Add online multiplayer support where humans can join an existing game and take over an AI party (during running or paused game).
- The interface should be minimalistic
- in the sidebar below the "Players: " input there will be a label for each active party in the game like "Red: NameOfRedPlayer" and so on. Each row has another party listed.
  - on the right of each row is a small invite button that generates an invite link to take over that party by a human player on the internet
  - when a human opens the link in a browser the game is started and the browser connects to that game and the party is taken over by that player.
- Before connecting the new player has to enter his name/alias. After that he will join immediately to the running or paused game of the host.
- Use WebRTC to connect the browsers directs to one another so no gaming server is needed. The host browser will serve as the source of truth when more than 2 players are joined.
- the host will get a notification when a player joined successfully.
- when a party disconnects i.e. by closing the tab the party will immediately be taken over by an ai player again but the invite link will work again if opened again in a browser.
- the invite link is specific to a game instance and a party
- any party can save the game but when a non host will load the game this non host will be the new host and the game instance will be different and also the invite links will be different from the original.
- only the host can start/pause the game or use cheats
- For the initial webRTC connection setup use a small express server for STUN

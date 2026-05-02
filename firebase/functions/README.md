# Flytok Cloud Functions

Push delivery for direct messages.

## Deploy

This requires interactive login — run from a shell where you're logged into the
`roamerz-b0056` Firebase project:

```
cd firebase/functions
npm install
npm run build
npm run deploy
```

(`firebase deploy --only functions:onMessageCreated`)

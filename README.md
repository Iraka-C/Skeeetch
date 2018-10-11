# Skeeetch
Project for HackPKU 2018
You can try it [here](https://iraka-c.github.io/Skeeetch/index.html)
## Introduction
This is an advanced version for [Sketchpad](https://github.com/Iraka-C/Sketchpad)
with transform management, transparency control, history control, etc.
Also, this project accepted the [pointer events](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent) API, so you can use a Force Touch device / Graphics board to create pressure-controlled strokes.
## For Network Developers
* Skeeetch accepts exterior control to the canvas UI by periodic GET request. (e.g. a smartphone | watch) For more information, see Network.js in this repo.
## Known Bugs & Todos
* Transform in CSS3 on matrix isn't smooth ==> Try quaternion?
* Some UIs may fail to react to "Scroll" operation on graphics board (especially when cursor moved out of browser window, maybe cause my the conflict between mouse & board cursor)
* No layer blend mode
* No stroke smoothness control
* No pressure-control on opacity / thickness switch
* No user manual
* No Redo action

* Scroll up/down/left/right: translate the canvas (pan)
* Shift + pointer drag on canvas: pan

## Known Problems

* Firefox: Pen drag causes freezing: move the pen outside of the client window to make it working again.
  * can be avoided by ```EventDistributer.setClick``` to remove dragging
* Firefox: Pen pressure: ```dom.w3c_pointer_events.dispatch_by_pointer_messages``` set to true
* Chrome: very slow on large files / multiple layers: composite layer takes too much time
  * According to [https://csstriggers.com/](https://csstriggers.com/), transform setting triggers only layer composition. Don't know why so large performance difference.
* Chrome: drag doesn't work on layer
* Firefox: doesn't allow text cursor positioning on click
* @TODO: In Firefox, pen could not draw into under the menu


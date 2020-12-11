# Paper and System

This chapter describes the operations on paper settings and system settings. They mainly locate in the **Setting** menu.

Most settings in the menu will be saved automatically after you change them.

## Paper

### Draw something

Use the left button of the mouse/touch pad/pen to draw lines on the paper. Please refer to the [笔刷帮助](./brush.md) chapter.

 ### Color picker

Use the right click or `Alt`+Left click to pick a color from the paper and load it to the palette. The color picked is what you see on the paper.

### Paper position

#### Zoom

Change the value of **zoom** (in percentage) to change the position of the paper. You can drag the value, scroll on the value, or input the value by keyboard to change it. You may also scroll on the canvas area (or drag up & down with two fingers on a touchpad) to zoom in/out.

#### Rotate

Press `Shift` while scrolling on the canvas area to rotate the paper. You can also change the value of  **rotate** (in degrees clockwise) by dragging the value, scrolling on the value, or entering the value by keyboard. If you press `Shift` while scrolling on the **rotate** value, it rounds to the multiples of 5 degrees.

You can also rotate the paper by dragging the paper with right mouse button while pressing `Shift` key. When the paper is positioned near a horizontal/vertical direction, it will be attracted to that direction.

#### Pan

Press `Shift` while dragging the paper will **move** the paper horizontally/vertically. You can see a "moving" cross shaped mouse cursor. It is also possible to move the paper by dragging on the touchpad around with two fingers while pressing `Ctrl` key, or scrolling on the paper while pressing `Ctrl` key.

#### Flip

Click the `⇆` button on the bottom-right corner will **flip** the paper horizontally. This is only a flip of the view, NOT the actual contents in the paper.

#### Reset

**Reset paper position** by clicking on the `[•]` button.

### Pan a layer or group

When you select a layer/group as active, press `Ctrl` key and drag on the paper to move only this layer/group. The cursor will turn into an arrow.

**Notice**: if the layer/group is locked/opacity locked, or it is within/contains a locked layer/group, you cannot pan this layer/group.

### Undo and redo

Skeeetch supports undo and redo actions to surf through the drawing history. You can click the `<<` or `>>` button to undo/redo one step, or to use the hotkey `Ctrl+z` for undo, and `Ctrl+Shift+z` or `Ctrl+y` to redo. If you're using a mouse, clicking previous/next key has the same effect.

> Old history actions will be discarded. The steps of history depends on the RAM strategy and the system configurations.

## System Settings

Skeeetch can be configured in the **Settings** menu. The following contents introduce the items in the Setting menu.

### Bit depth

Bit depth specifies how many bits are used to represent one color channel of one pixel. Possible values are `8 bit` (byte), `16 bit` (half float), or `32 bit` (float). The higher the bit depth, the more precise the color will be rendered. However, a higher bit depth also means taking up more VRAM/RAM resources. 32 bits are needed to guarantee very precise color/alpha channel rendering, but the exact bit depth to use depends on the requirements of your task.

### Opacity blend

This item specifies the algorithm for alpha channel blending. Please refer to [图层说明](./layers.md#混合模式)。

### Anti-aliasing

Anti-aliasing (AA) applies to both the paper display and the brush rendering. When you turn off AA, the rendering is performed point-to-point, which may cause unpleasant edges when drawing (left).

<img src="./images/antialiasing.png" width="400"/>

If you enable AA (right), Skeeetch will perform interpolation algorithms to smooth the edges (right), which may be a performance bottleneck in extreme cases. If you are drawing pixel arts, turn off AA to get the sharpest pixels.

### Transform animation

Skeeetch will play a smooth transition animation when you adjust the position of the paper. If you are not fond of such a sluggish effect, or such an effect causes lags during your use, turn off transform animation in this setting item.

### UI layout

You can toggle UI layout to decide whether you want the layer panel to be on the left or right of the window.

### Color theme

Skeeetch has two internal themes: light and dark. Choose the UI style you like with this setting.

<img src="./images/ui-dark.png" height="200"/> <img src="./images/ui-light.png" height="200"/>

> Dark theme (left) & light theme (right)

### Toggle fullscreen

点击**切换全屏幕显示**按钮可让当前Skeeetch页面在全屏幕/窗口显示之间切换。你也可以使用浏览器自带的全屏显示快捷键。

> 不是所有浏览器都支持全屏幕显示

### 调色盘设置

详见[调色盘帮助](./palette.md)。

### 语言

目前并没有设置更改语言选项。可以通过添加url的lang参数来切换语言。

https://iraka-c.github.io/Skeeetch/gl/index.html?lang=en 英文版（未完善）

https://iraka-c.github.io/Skeeetch/gl/index.html?lang=zh 中文版

> 其他语言？看有没有人愿意翻译和检查咯。详见开发者。

## 性能

### 显存限制

这里可以调节允许Skeeetch使用多少显存（大致）。

Skeeetch至少需要1~2GB的显存来正常工作。查看你的计算机显卡配置和日常使用情况来调节显存的限制量。

注意：这个设置不可以使用拖动或鼠标滚轮来调节！请使用键盘输入。

### 刷新率限制

这里可以调节Skeeetch允许的最高刷新率（帧率）。

较低的刷新率可以减少Skeeetch的计算和资源消耗，但也可能造成肉眼可见的闪烁。这里刷新率指的是每秒**界面刷新**的次数，和渲染器以及笔刷的绘制效果无关。

### 开发者选项

详见开发者（？）

**绘制图层边缘**

绘制当前图层内容占用的GLTexture和记录的有效内容的边缘

### 系统信息

这一栏将显示Skeeetch运行环境的一些信息。

**内存使用**项目显示Skeeetch的内存用量。这些占用主要是历史记录和已缓存的图层信息。

**显存使用**项目显示Skeeetch的显存用量。显存主要由Skeeetch的渲染器占用。

**硬盘使用**项目显示Skeeetch的硬盘用量。这些空间主要用于自动保存的工作区内容。

以上的存储空间使用为Skeeetch估计的结果。由于操作系统/浏览器/显卡驱动的空间分配策略不同，可能出现显示的用量和实际占用量不一致，或者无法读取到相关参数的情况。

Skeeetch默认支持4G的内存和显存。


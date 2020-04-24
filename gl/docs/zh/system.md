# 画纸和系统

这一章讲述关于画纸和系统设置的操作。

## 画纸操作

### 绘制

在画纸上用鼠标左键/触摸/数位笔等点击并拖动来绘制图形。详见[笔刷帮助](./brush.md)章节。

 ### 取色

在画纸上用右键或Alt加左键点击来设置[调色盘](./palette.md)颜色为当前位置的颜色。取色时光标将变为十字。取色来源为整个画布。

### 调整画布位置

改变右下角的缩放数值和旋转角度数值，就可以调节画布的**缩放**和**旋转**。缩放数值和旋转数值可以通过键盘输入、使用鼠标左右拖动、或者在数值上使用滚轮。

画布的**缩放**也可以直接用鼠标滚轮在画布上滚动来改变。在有触摸板的设备上，使用双指上下拖动有类似的效果。

按下Shift键并用鼠标左键拖动可以**平移**整个画布。此时光标会变为十字箭头状。也可以通过按下Shift键（水平）或Ctrl键（垂直）并滚动来平移画布。在有触摸板的设备上，按下Ctrl键并使用双指拖动有类似的效果。

如果想**恢复**默认的画布位置，点击右下角的`[•]`按钮。

点击右下角的`⇆`按钮可以**水平翻转**画布的显示。注意这个按钮只改变画布的显示效果，并不改变图像的内容。按钮会在画布已翻转时高亮为红色。

### 平移当前图层·图层组

在选定一个图层或图层组时，按下Ctrl键并拖动可以调整这个图层或图层组在画纸上的位置。拖动时光标会变成小箭头状。

> 将来（？）会支持更多种类的图层形变

### 撤销和重做

Skeeetch在绘制过程中会记录操作历史。在右下角的面板中可以通过单击`<<`或`>>`来回到上一步/下一步的状态。也可以使用快捷键`Ctrl+z`进行撤销，以及`Ctrl+Shift+z`或者`Ctrl+y`进行重做。

> 过于久远的历史会被丢弃。具体历史记录的数量与系统的内存设置有关。

## 系统设置

Skeeetch的系统设置可以在**设置**菜单中调节。以下项目按从上到下的顺序介绍相应设置内容。

### 位深度

位深度指在渲染的时候用多少比特来储存一个像素的一个颜色通道。目前可用的设置为8位（非负整数）或32位（单精度浮点）。位深度越高则渲染越精确，不容易出现伪色/杂色/画笔波纹等，但也意味着Skeeetch运行时占用的内存和显存越多。对于需要精确控制色彩表现的任务，推荐使用32位深度。

### 纸张宽度和高度

这两项设置当前画纸的宽度和高度（像素）。调整为目标尺寸数值后，需要点击下方的**改变尺寸**按钮来正式更改画纸尺寸。改变画纸尺寸后，所有历史记录将被清空，超出画纸尺寸的部分也可能会被丢弃。

### 抗锯齿

抗锯齿对画纸的显示和笔刷设置均有效。关闭抗锯齿时，笔刷和画布的渲染是点对点完成的。在缩放画纸或者使用硬边缘笔刷对时候将导致线条的边缘出现可见的锯齿（左）。

<img src="./images/antialiasing.png" width="400"/>

打开抗锯齿后绘制（右），Skeeetch将试图在渲染时通过插值的方式来降低这些像素锯齿对观感的干扰。注意如果希望渲染像素画，打开抗锯齿反而会使得边缘模糊。

### 调色盘设置

详见[调色盘帮助](./palette.md)。

### 过渡动画

Skeeetch在调整画纸位置的时候会启用平滑的过渡动画。如果你讨厌这种慢吞吞的过渡效果，或者过渡动画导致了Skeeetch的卡顿，那么将**过渡动画**设置为关将停用这些过渡效果。

### 切换全屏幕显示

点击**切换全屏幕显示**按钮可让当前Skeeetch页面在全屏幕/窗口显示之间切换。

> 不是所有浏览器都支持全屏幕显示

### 语言

目前并没有设置更改语言选项。可以通过添加url的lang参数来切换语言。

https://iraka-c.github.io/Skeeetch/gl/index.html?lang=en 英文版（未完善）

https://iraka-c.github.io/Skeeetch/gl/index.html?lang=zh 中文版

> 其他语言？看有没有人愿意翻译和检查咯。详见开发者。

### 开发者选项

详见开发者（？）

### 系统信息

这一栏将显示Skeeetch运行环境的一些信息。

**内存使用**项目显示Skeeetch的内存用量。这些占用主要是历史记录和已缓存的图层信息。

**显存使用**项目显示Skeeetch的显存用量。显存主要由Skeeetch的渲染器占用。

以上的存储空间使用为Skeeetch估计的结果。由于操作系统/浏览器/显卡驱动的空间分配策略不同，可能出现显示的用量和实际占用量不一致的情况。
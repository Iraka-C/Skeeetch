# 图层

Skeeetch支持图层和图层组的管理。图层的操作界面位于主界面左侧的**图层**选项卡，分为顶部的按钮和下方的图层列表两部分。

图层按面板顶部右侧有`<`按钮，可以用于切换图层栏的展开/收缩。收缩后的图层栏将只显示每个图层小的缩略图。

每个图层的背景是这个图层内容的**缩略图**。当缩略图尺寸大于图层图标时，在图层图标上移动光标可以浏览缩略图的不同部分。

## 增删图层

默认打开Skeeetch时的第一个图层是一个白色的背景图层。

点击图层面板<img src="/Users/iraka/Documents/GitHub/Skeeetch/gl/resources/new-layer.svg" height="24"/>按钮**新建**一个图层。你可以在图层名处输入来给新图层**重命名**。

点击某个图层的图标，图层图标会**点亮**指示当前绘制的对象是这个图层。

点击图层面板<img src="/Users/iraka/Documents/GitHub/Skeeetch/gl/resources/delete.svg" height="24"/>按钮将当前活动的图层**删除**。

在图层列表内图标过多时右侧会出现滚动条，可以拖动滚动条或在图层列表上滚动来上下浏览所有图层。

## 增删图层组

点击图层面板<img src="/Users/iraka/Documents/GitHub/Skeeetch/gl/resources/new-group.svg" height="24"/>按钮**新建**一个图层组。图层组自身上不可绘制任何内容，但可以包含其他图层或图层组。你可以在图层组名处输入来给新图层组**重命名**。

点击某个图层组的图标，图层组的展开按钮`>`会**点亮**指示当前操作的对象是这个图层组。

点击图层组的展开按钮`>`可以在**展开/折叠**显示图层组内容之间切换。

点击图层面板<img src="/Users/iraka/Documents/GitHub/Skeeetch/gl/resources/delete.svg" height="24"/>按钮将当前活动的图层组**删除**。

## 改变图层顺序

按下一个图层/图层组的图标并在图层列表中**拖动**可以调整图层的顺序。你可以改变图层的前后顺序，将一个图层/图层组拖入或拖出某个图层组的列表。

## 图层属性

在图层标志左上角的不透明度百分比处输入数值/光标左右拖动/滚动可以调节图层的**不透明度**。从0%到100%的值对应完全透明到完全显示。在数值上右键单击或按住Shift键单击可以**隐藏/显示**图层。隐藏的图层不透明度将显示为`----`。隐藏的图层将无法绘制，也无法移动。

图层标志的右上角有几个按钮。最右上的是**锁定**按钮。点击它可以在解锁<img src="/Users/iraka/Documents/GitHub/Skeeetch/gl/resources/unlock.svg" height="16"/>、锁定不透明度<img src="/Users/iraka/Documents/GitHub/Skeeetch/gl/resources/opacity-lock.svg" height="16"/>、锁定<img src="/Users/iraka/Documents/GitHub/Skeeetch/gl/resources/all-lock.svg" height="16"/>之间切换。锁定不透明度后图层像素的不透明度将不会改变，也无法移动。锁定后图层的任何像素将无法改变，只能改变隐藏/显示状态、剪贴蒙版、和编辑图层名。

（混合模式未完善）

左下角的<img src="/Users/iraka/Documents/GitHub/Skeeetch/gl/resources/clip-mask.svg" height="16"/>按钮是**剪贴蒙版**按钮，点击以切换剪贴蒙版状态。剪贴蒙板图层或图层组的右下角将显示一个灰色的三角标志。剪贴蒙版图层只显示其下方普通图层的不透明部分对应的内容。

（蒙版未完善）

图层组也有类似的属性，可以在图层组面板中点击对应的按钮来调整。注意：图层组的锁定按钮状态对其下属的所有图层/图层组均有效。

## 清空图层

详见[画纸和快捷键操作（未完善）]()

## 合并图层组

当某个图层组被选定时，图层面板中将出现<img src="/Users/iraka/Documents/GitHub/Skeeetch/gl/resources/merge-group.svg" height="24"/>按钮。点击此按钮将这个图层组所有内容合并为一个图层，并取代原图层组的位置。

## 复制图层/图层组

（功能尚未实现）
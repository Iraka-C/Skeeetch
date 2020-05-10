# 笔刷

本章Skeeetch的笔刷管理和渲染算法

## 笔刷管理



## 笔刷渲染

笔刷渲染由两部分组成：**轨迹生成**和**纹理渲染**。一个笔刷可以看作将一个贴图纹理沿一定的轨迹不断叠加的过程，而轨迹生成负责计算纹理叠加的位置和方向，纹理渲染负责将纹理按生成的轨迹放到画布上。

### 简单轨迹生成

一个最基本的轨迹是一条二阶贝塞尔曲线（抛物线）。在`CANVAS.stroke`中将贝塞尔曲线的三个控制点传给`CANVAS.renderer.strokeBezier`函数来得到轨迹。这三个控制点分别是：上上次光标位置和上次光标位置的中点、上次光标位置、与上次光标位置和此次光标位置的中点。

<img src="./images/curve01.png" width="600"/>

> 深蓝色的点为CANVAS接收到的光标轨迹，橙色的点为深蓝色点的中点，表示贝塞尔曲线的开始和结束控制点。橙色曲线为生成的轨迹。

`CANVAS.renderer.strokeBezier`为renderer基类`BasicRenderer`的方法，其中用到了`q-bezier.js`中的`QBezier`类。这个类的对象描述了一条二阶（含一阶、零阶）贝塞尔曲线，有很多关于求值和长度计算的方法。

从光标位置得到`QBezier`轨迹之后，由于笔触的各个位置颜色应当是均匀的，而实际接收到光标位置的间距不均匀，同时贝塞尔曲线的弧长与参数变化量之比也是（极其）不均匀的，我们需要沿轨迹**等距**地布置纹理位置。这使用到了通过曲线长求参数的`QBezier.getTWithLength`方法。这个方法通过二分法（精度$10^{-4}$）求使得曲线长为目标长度的参数$t$的方程来得到新的纹理位置。方程求解的函数为`QBezier.getArcLength`函数，使用具有显式表达式的曲线长定积分来计算弧长。（拥有弧长的显式表达式也是二阶贝塞尔曲线的优点）定积分的求解位于`QBezier._getQuadraticIntegrateVal`函数中。实际应用中计算定积分和方程求解的时间相比渲染时间可以忽略不计。

<img src="./images/curve02.png" width="400"/>

> 均匀参数（左）和均匀弧长（右）的分布效果

得到纹理中心的位置后，就可以根据位置对应的参数对压感、笔刷半径、透明度等参数进行插值，并最终输出一个`[wL,wH,hL,hH,kPoints]`型的轨迹。其中`wL,wH,hL,hH`描述了轨迹渲染的最大/最小像素范围，`kPoints=[[x,y,r,d,Sa,Pa], ...]`描述了一系列贴图位置的参数。

### 铅笔

铅笔是最简单的通过

### 画笔

画笔可以看作一个带有颜色“惯性”的铅笔。

画笔相比普通笔刷多出了额外参数`brush.extension`，即延伸量。画笔的渲染逻辑依然是先渲染到临时纹理`brushtipImageData`再复制回原`imageData`，只不过多出了颜色采样的部分，而延伸量控制的即为颜色采样的比例。绘制的流程如下：

1. 从源图像的笔刷中心位置选取颜色`samp_color`（$C_s$），并乘以采样比例$\alpha$。
2. 将笔刷颜色$C_c$乘以采样比例$1-\alpha$，并和源图像颜色采样相加。
3. 将相加后的颜色乘以笔刷纹理透明度$\beta$，绘制到临时纹理。
4. 将临时纹理以普通混合模式绘制到源图像相应位置。

<img src="./images/paint-brush-mix.png" width="400"/>

---

我们考察这样的情况：从原色$C_s$向背景颜色$C_b$上延伸笔刷颜色$C_c$。

如果假设绘制第$n$个纹理时，绘制前笔刷中心位置的颜色为$a_{n-1}$，绘制后颜色为$a_n$，如果源图像透明度为1（完全不透明），则从上述步骤可以得出如下关系：
$$
\begin{aligned}
	a_{n}&=(1-\beta)a_{n-1}+\beta(\alpha a_{n-1}+(1-\alpha)C_c) \\
	&=(1-\beta(1-\alpha))a_{n-1}+\beta(1-\alpha)C_c \\
	a_{1}&=(1-\beta)C_b+\beta(\alpha C_s+(1-\alpha)C_c)
\end{aligned}
$$
要计算经过$n$步混合后的颜色，设$1-\beta(1-\alpha)=k$，于是有：
$$
\begin{aligned}
	a_{n} &= k a_{n-1}+(1-k)C_c \\
	&= k^{n-1} a_1 + (1-k^{n-1})C_c \\
	&= k^{n-1}((1-\beta)C_b+\alpha\beta C_s+(1-k) C_c) + (1-k^{n-1})C_c \\
	&= k^{n-1}(1-\beta)C_b+\underline{k^{n-1}\alpha\beta}C_s+\underline{(1-k^{n})}C_c
\end{aligned}
$$
我们希望笔尖在运动在给定的相对笔刷直径的距离$d$之后新颜色$C_c$能增加至一定的比例。假设画过$d=1$倍直径的距离后笔刷颜色含量增加为$\delta$（即笔刷颜色不透明度），由于1倍直径中包含$q=$`renderer.quality`次绘制，此时的$C_c$含量为：
$$
\begin{aligned}
	1-k^q=\delta
\end{aligned}
$$
另外，希望原色$C_s$含量在剩余的$1-\delta$部分颜色中减至$\varepsilon\in [0,1]$，于是有：
$$
\begin{aligned}
	k^{q-1}\alpha\beta=(1-\delta)\varepsilon
\end{aligned}
$$
综合上述方程，可以得到：
$$
\begin{cases} 
    k^q &= 1-\delta \\
   \alpha\beta &= k\varepsilon \\
   1-\beta(1-\alpha) &= k
\end{cases}
$$
解得：
$$
\begin{cases} 
    k &= (1-\delta)^{1/q} \\
   \beta &= 1-(1-\varepsilon)k \\
   \alpha &= k\varepsilon/\beta
\end{cases}
$$
可以发现$k$就是之前在铅笔算法处推算出的**笔刷纹理透明度**。另外，$\varepsilon$控制了颜色延伸量，但这并不是一个随`brush.extension`均匀变化的参数。用：
$$
\varepsilon=-\frac{\ln(1-{\rm extension})}{{\rm quality}/6}
$$
得到视觉上和`brush.extension`符合较好的延伸量，由于可能出现$\varepsilon>1$，需要做截断。注意由于软边笔刷沿笔触透明度相比硬边画笔都是降低的，降低Hard Edge会使得延伸量也同时略微减小。

此外，如果背景颜色$C_b$带有透明度，画笔混色算法会将$C_s$的透明度一并叠加到$C_b$上，使得延伸量的模型发生变化。无所谓啦……





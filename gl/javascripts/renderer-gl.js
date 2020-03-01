/**
 * 32-bit webgl renderer
 * On common browsers, the maximum size of a texture should be 16384^2
 */
class GLRenderer extends BasicRenderer {
	/**
	 * Constructor: when starting the whole program or switching rendering method
	 * Only one canvas: set it as target
	 */
	constructor(param) {
		super(param);

		const gl=this.canvas.getContext("webgl",{
			premultipliedAlpha: true // premult: (r,g,b,a)->(ar,ag,ab,a)
		}); // webgl context
		this.gl=gl;
		//this.textureBlender=new GLTextureBlender(gl);

		// init settings
		gl.disable(gl.DEPTH_TEST); // do not use depth buffer (2d rendering) @TODO: faster?
		gl.enable(gl.BLEND); // enable blend function
		gl.blendEquation(gl.FUNC_ADD); // always add: using gl.blendFunc to erase
		// Device dependent: float texture
		gl.getExtension('OES_texture_float');
		gl.getExtension('OES_texture_float_linear');

		// =================== Create Programs ====================
		this._initCircleProgram();
		this._initRenderCanvasProgram();

		// ================= Create Framebuffer ================
		// for rendering to imagedata
		this.framebuffer=gl.createFramebuffer(); // create a new framebuffer from gl
		gl.viewport(0,0,this.canvas.width,this.canvas.height);

		// This is a blank texture for blending
		// every pixel is white color [1,1,1,1]
		this.blankTexture=WebGLUtils.createAndSetupTexture(gl);
		gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,this.canvas.width,this.canvas.height,0,gl.RGBA,gl.FLOAT,null);
		gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer); // render to a this.blankTexture
		gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.blankTexture,0);
		gl.clearColor(1,1,1,1); // Set clear color
		gl.clear(gl.COLOR_BUFFER_BIT); // set all pixels in blankTexture

		// blender
		this.textureBlender=new GLTextureBlender(gl,this.framebuffer);
	}


	_initCircleProgram() {
		// slice number of a circle divided
		const circleSliceN=64;
		this.circleSliceN=circleSliceN;

		// add the glsl codes inside a closure
		const vCircleShaderSource=glsl` // vertex shader for drawing a circle
			// circle id (not used) is the order of the circle to be drawn
			// face id is the order of the triangle in the circle
			// vertex id is the order of the vertex in a triangle (0,1,2)
			// OpenGL guarantees the primitive rasterization order same as VBO
			#define DBPI 6.2831853071795864769 // 2*PI

			attribute float a_id; // vertex id: faceid*3+vertexid

			uniform vec2 u_resolution; // canvas resolution
			uniform float u_circle_slice_N; // slice number of a circle divided

			uniform vec3 u_pos; // circle position (x,y,r)
			varying float rel; // linear opacity interpolation
			void main(){
				if(mod(a_id,3.0)<0.5){ // 0' vertex
					vec2 center_clip=(u_pos.xy/u_resolution*2.0-1.0)*vec2(1.0,-1.0);
					gl_Position=vec4(center_clip,0.0,1.0);
					rel=1.0;
				}
				else{ // 1',2' vertex
					float id=floor((a_id+1.0)/3.0);
					float u=id/u_circle_slice_N; // 0~1
					float angle=u*DBPI;
					vec2 d_pos=vec2(cos(angle),sin(angle))*u_pos.z;
					vec2 pos=u_pos.xy+d_pos;
					vec2 v_clip=(pos/u_resolution*2.0-1.0)*vec2(1.0,-1.0);
					gl_Position=vec4(v_clip,0.0,1.0);
					rel=0.0;
				}
			}
		`;

		const fCircleShaderSource=glsl`
			precision mediump float;
			uniform float u_softness; // circle edge softness
			uniform vec4 u_color; // rgba
			varying float rel;
			void main(){
				//float opa=smoothstep(0.0,u_softness,rel); // sharper than following
				if(rel>=u_softness){
					gl_FragColor=u_color;
				}
				else{ // sample on this function averages to 1/3
					float r=rel/u_softness;
					float opa=r*r;
					gl_FragColor=u_color*opa;
				}
			}
		`;
		// ================= Create program ====================
		this.circleProgram=WebGLUtils.createProgramFromScripts(
			this.gl,vCircleShaderSource,fCircleShaderSource);
		// ================ Create buffer ================
		this.circleProgramBuffer={
			"a_id": this.gl.createBuffer()
		};

		// prepare vertices id array
		const vertexIdArray=new Float32Array(this.circleSliceN*3);
		vertexIdArray.forEach((v,i) => {vertexIdArray[i]=i;});
		WebGLUtils.setBuffer(this.gl,this.circleProgramBuffer["a_id"],vertexIdArray);
	}

	_initRenderCanvasProgram() {

		// add the glsl codes inside a closure
		const vCanvasShaderSource=glsl` // vertex shader for drawing a circle
			attribute vec2 a_position; // vertex position
			varying vec2 v_position;
			void main(){
				v_position=a_position;
				gl_Position=vec4(a_position*2.0-1.0,0.0,1.0); // to clip space
			}
		`;

		const fCanvasShaderSource=glsl`
			precision mediump float;
			uniform sampler2D u_image;
			varying vec2 v_position;
			void main(){
				gl_FragColor=texture2D(u_image,v_position);
			}
		`;
		// ================= Create program ====================
		this.canvasProgram=WebGLUtils.createProgramFromScripts(
			this.gl,vCanvasShaderSource,fCanvasShaderSource);
		this.canvasProgramBuffer={
			"a_position": this.gl.createBuffer()
		};
		// vertex order of a rectangle
		WebGLUtils.setBuffer(this.gl,this.canvasProgramBuffer["a_position"],[0,0,1,0,0,1,0,1,1,0,1,1]);
	}

	// Init on specifying a new texture to be rendered
	init(param) {
		super.init(param); // init canvas

		if(param.imageData.type!="GLTexture") { // not GL texture type
			throw new Error("ImageData type "+param.imageData.type+" not GLTexture");
		}
		// init rendering environment

		// attach the target texture to fbo
		this.texture=param.imageData.data;
	}

	// Init before every stroke: setting the rendering environment
	initBeforeStroke(param) {
		super.initBeforeStroke(param);
		//console.log(this.brush);
	}

	/**
	 * render a series of key points (plate shapes) into the buffer
	 * [wL,wH,hL,hH] is the range of plates to be rendered
	 * kPoints[v] = [x,y,r,a] * a may be larger than 1 !
	 */
	renderPoints(wL,wH,hL,hH,kPoints) {
		const gl=this.gl;
		const program=this.circleProgram;

		// set blend mode
		let rgb=[this.rgb[0]/255,this.rgb[1]/255,this.rgb[2]/255]; // color to use: unmultiplied
		if(this.brush.blendMode==0) { // add: pen, brush, ...
			if(this.isOpacityLocked){ // destination opacity not change
				gl.blendFunc(gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA); // a_dest doesn't change
			}
			else{
				gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA); // normal blend mode *Lossy when 8bit int!
			}
		}
		else { // erase: eraser
			if(this.isOpacityLocked){ // destination opacity not change
				rgb=[1,1,1]; // white
				gl.blendFunc(gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA); // a_dest doesn't change
			}
			else{
				gl.blendFunc(gl.ZERO,gl.ONE_MINUS_SRC_ALPHA); // no color
			}
		}

		gl.useProgram(program); // to draw circles
		gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer); // render to this framebuffer: now active layer texture
		gl.framebufferTexture2D( // framebuffer target is this.texture
			gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.texture,0);

		// Set Attributes
		WebGLUtils.setAttribute(gl,program,"a_id",this.circleProgramBuffer["a_id"],1);

		// Set uniform
		WebGLUtils.setUniformFloat(gl,program,"u_resolution",[this.canvas.width,this.canvas.height]);
		WebGLUtils.setUniformFloat(gl,program,"u_circle_slice_N",this.circleSliceN);

		const fixedSoftEdge=this.antiAlias? 2:0; // a soft edge with fixed pixel width for anti-aliasing
		for(let k=0;k<kPoints.length;k++) { // each circle in sequence
			const p=kPoints[k];
			const opa=p[3];
			const softRange=this.softness+fixedSoftEdge/p[2];
			WebGLUtils.setUniformFloat(gl,program,"u_pos",[p[0],p[1],p[2]]); // set circle size and radius
			WebGLUtils.setUniformFloat(gl,program,"u_color",[rgb[0]*opa,rgb[1]*opa,rgb[2]*opa,opa]); // set circle color
			WebGLUtils.setUniformFloat(gl,program,"u_softness",softRange);
			gl.drawArrays(gl.TRIANGLES,0,this.circleSliceN*3);
		}
	}

	// source is a texture
	drawCanvas(imgData) {
		const gl=this.gl;
		const program=this.canvasProgram;

		gl.blendFunc(this.gl.ONE,this.gl.ONE_MINUS_SRC_ALPHA); // normal blend

		gl.useProgram(program); // to draw canvas
		gl.bindFramebuffer(gl.FRAMEBUFFER,null); // render to canvas
		// prepare vertices id array
		WebGLUtils.setAttribute(gl,program,"a_position",this.canvasProgramBuffer["a_position"],2);

		gl.bindTexture(gl.TEXTURE_2D,imgData.data); // set this texture as source
		gl.clearColor(0,0,0,0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES,0,6);
	}

	// ============= ImageData (texture) Operation =============
	createImageData() { // imagedata contains a texture
		// @TODO: change to context2D-like operation functions
		const gl=this.gl;
		let texture=WebGLUtils.createAndSetupTexture(gl);
		gl.texImage2D( // setup texture format
			gl.TEXTURE_2D,0,gl.RGBA, // texture type, level(0), texture color format
			this.canvas.width,this.canvas.height,0, // size[w,h], border(0)
			gl.RGBA, // texel color format (==texture color format)
			gl.FLOAT,null // 32bit/channel float for RGBA, empty
		);
		return { // a texture - image data type
			type: "GLTexture",
			data: texture,
			id: LAYERS.generateHash("tex"), // for DEBUG ONLY!
			width: this.canvas.width,
			height: this.canvas.height,
			left: 0,
			top: 0
		};
	}

	deleteImageData(imgData) { // discard an image data after being used
		this.gl.deleteTexture(imgData.data);
	}

	// clear the comtents with white
	clearImageData(target,range,isOpacityLocked) {

		if(isOpacityLocked) { // the opacity of each pixel doesn't change
			this.textureBlender.blendTexture(this.blankTexture,target.data,{
				alphaLock: true,
				mode: "source"
			});
		}
		else { // Pre-multiply
			const gl=this.gl;
			gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer); // render to a texture
			gl.framebufferTexture2D( // framebuffer target
				gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target.data,0);
			gl.clearColor(0,0,0,0); // Set clear color
			gl.clear(gl.COLOR_BUFFER_BIT); // Clear the color buffer with specified clear color
		}
	}
	// ====================== Blend Functions =========================
	// add source to target (all imagedata),
	blendImageData(source,target,param) {
		this.textureBlender.blendTexture(source.data,target.data,param);
	}

	// ====================== Data type transforms =======================
	// source is a gl texture img data
	// targetSize is [w,h]
	imageDataToUint8Array(source,targetSize) {
		const gl=this.gl;
		const program=this.canvasProgram;

		// Setup temp texture for extracting data
		gl.viewport(0,0,targetSize[0],targetSize[1]); // set size to target
		let tmpTexture=WebGLUtils.createAndSetupTexture(gl);
		gl.texImage2D( // target is unsigned byte
			gl.TEXTURE_2D,0,gl.RGBA,
			targetSize[0],targetSize[1],0,
			gl.RGBA,gl.FLOAT,null
		);
		gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer); // render to a texture
		gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tmpTexture,0);

		// Run program to get a zoomed texture
		gl.blendFunc(this.gl.ONE,this.gl.ZERO); // copy
		gl.useProgram(program);
		WebGLUtils.setAttribute(gl,program,"a_position",this.canvasProgramBuffer["a_position"],2);
		gl.bindTexture(gl.TEXTURE_2D,source.data); // bind source
		gl.drawArrays(gl.TRIANGLES,0,6); // render to tmpTexture

		// read pixels from texture, takes time (~3ms)
		let pixels=new Float32Array(targetSize[0]*targetSize[1]*4);
		gl.readPixels(0,0,targetSize[0],targetSize[1],gl.RGBA,gl.FLOAT,pixels); // read from buffer

		gl.viewport(0,0,this.canvas.width,this.canvas.height); // restore viewport
		gl.deleteTexture(tmpTexture);

		// alpha premult => un-premult color
		let pixelsUint8=new Uint8ClampedArray(pixels.length);
		for(let i=0;i<pixels.length;i+=4){ // @TODO: flip Y
			let opa=pixels[i+3];
			pixelsUint8[i]=pixels[i]/opa*256; // 256 will be clamped
			pixelsUint8[i+1]=pixels[i+1]/opa*256;
			pixelsUint8[i+2]=pixels[i+2]/opa*256;
			pixelsUint8[i+3]=opa*256;
		}

		return pixelsUint8;
	}
}

class WebGLUtils {
	// Create a program with two shaders
	static createProgramFromScripts(gl,vScript,fScript) {
		/**
		 * Complie a shader from script
		 * shaderType: The type of shader, VERTEX_SHADER or FRAGMENT_SHADER.
		 */
		function compileShader(gl,shaderSource,shaderType) {
			let shader=gl.createShader(shaderType); // Create the shader object
			gl.shaderSource(shader,shaderSource); // Set the shader source code.
			gl.compileShader(shader); // Compile the shader
			const success=gl.getShaderParameter(shader,gl.COMPILE_STATUS); // Check if it compiled
			if(!success) { // Something went wrong during compilation; get the error
				throw "could not compile shader: "+gl.getShaderInfoLog(shader);
			}
			return shader;
		}
		let program=gl.createProgram();
		let vertexShader=compileShader(gl,vScript,gl.VERTEX_SHADER);
		let fragmentShader=compileShader(gl,fScript,gl.FRAGMENT_SHADER);
		gl.attachShader(program,vertexShader);
		gl.attachShader(program,fragmentShader);
		gl.linkProgram(program);
		const success=gl.getProgramParameter(program,gl.LINK_STATUS);
		if(success) {
			return program;
		}
		//ERROR
		console.log(gl.getProgramInfoLog(program));
		gl.deleteProgram(program);
	}

	/**
	 * Create an uninitialized texture
	 * fast: over 130kops/s combined with gl.texImage2D(null)
	 */
	static createAndSetupTexture(gl) {
		let texture=gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D,texture);
		// Set up texture so we can render any size image and so we are working with pixels.
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
		return texture;
	}

	// Set the framebuffer as target we are rendering to
	// fbo: null for gl.canvas
	// static setFramebuffer(gl,program,fbo,width,height) {
	// 	// make this the framebuffer we are rendering to.
	// 	gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
	// 	// Tell the shader the resolution of the framebuffer.
	// 	var resolutionLocation=gl.getUniformLocation(program,"u_resolution");
	// 	gl.uniform2f(resolutionLocation,width,height);
	// 	// Tell webgl the viewport setting needed for framebuffer.
	// 	gl.viewport(0,0,width,height);
	// }

	/**
	 * Set attribute (float, vec1~4) in a program
	 * (according to GL standards, attribute must be float)
	 * size specifies how many data in one turn to be taken
	 * e.g. for vec4: size=4
	 */
	static setAttribute(gl,program,attribName,buffer,size) {
		// store data in buffer
		gl.bindBuffer(gl.ARRAY_BUFFER,buffer);

		// assign attribute to read from buffer
		// Must after bindbuffer
		const attributeLocation=gl.getAttribLocation(program,attribName);
		gl.enableVertexAttribArray(attributeLocation);
		gl.vertexAttribPointer(attributeLocation,size,gl.FLOAT,false,0,0);
	}

	static setBuffer(gl,buffer,data) {
		gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
		gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
	}



	/**
	 * Set the float uniform value (number or) in a program
	 * data is a number or an array of length 1~4
	 */
	static setUniformFloat(gl,program,unifName,data) {
		var loc=gl.getUniformLocation(program,unifName);
		switch(data.length||0) {
			case 0: gl.uniform1f(loc,data); break; // Number
			case 1: gl.uniform1fv(loc,data); break; // vec1
			case 2: gl.uniform2fv(loc,data); break; // vec2
			case 3: gl.uniform3fv(loc,data); break; // vec3
			case 4: gl.uniform4fv(loc,data); break; // vec4
			default: throw new Error("Uniform data for "+unifName+" doen't match: "+data);
		}
	}
}
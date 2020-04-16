/**
 * Written by Iraka on 20200304
 * Helpers for WebGL application
 */

class GLProgram {
	// gl should enable float extension and premultiplied alpha
	constructor(gl,vShaderSrc,fShaderSrc) {
		function createProgramFromScripts(gl,vScript,fScript) {
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
		this.gl=gl;
		this.program=createProgramFromScripts(gl,vShaderSrc,fShaderSrc);
		this.attributeMap={}; // name-{size,turn,buffer}
		this.uniformMap={}; // name-{setUnifFunc,value}

		// frame buffer for texture rendering
		// create a new framebuffer from gl
		this.framebuffer=gl.createFramebuffer();
	}

	free(){
		const gl=this.gl;
		gl.deleteProgram(this.program);
		// @TODO: delete shaders?
		gl.deleteFramebuffer(this.framebuffer);
		for(let v in this.attributeMap) { // delete all attribute vertex buffers
			const attr=this.attributeMap[v];
			gl.deleteBuffer(attr.buffer);
		}
	}
	/**
	 * Setting the attribute variables in the program.
	 * data is the source where program reads attribute from: Number type Array.
	 * size specifies how many data to be taken in each turn.
	 * e.g. for vec4 type, size=4
	 */
	setAttribute(attribName,data,size) {
		const gl=this.gl;
		const program=this.program;
		if(!this.attributeMap[attribName]) { // attribute buffer not created yet
			this.attributeMap[attribName]={buffer: gl.createBuffer()};
		}

		const attr=this.attributeMap[attribName];
		attr.size=size; // set size
		attr.turn=data.length/size; // how many turns to be executed in vertex shader
		attr.location=gl.getAttribLocation(program,attribName);
		gl.bindBuffer(gl.ARRAY_BUFFER,attr.buffer);
		gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
	}

	/**
	 * Set the float uniform value (number or) in a program
	 * data is a number or an array of length 1~4
	 */
	setUniform(unifName,data) {
		const gl=this.gl;
		const program=this.program;
		if(!this.uniformMap[unifName]) { // uniform not assigned yet
			this.uniformMap[unifName]={};
		}

		const unif=this.uniformMap[unifName];
		// check data length 1~4 here
		unif.value=typeof (data)=="number"? [data]:data.concat(); // copy data
		unif.location=gl.getUniformLocation(program,unifName);
	}

	/**
	 * set texture 0
	 */
	setSourceTexture(texture) {
		this.srcTexture=texture;
	}

	/**
	 * set target
	 */
	setTargetTexture(texture) {
		this.tgtTexture=texture;
		const gl=this.gl;
		if(this.tgtTexture) { // render to texture
			gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);
			gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.tgtTexture,0);
		}
		else { // draw to canvas
			gl.bindFramebuffer(gl.FRAMEBUFFER,null);
		}
	}

	/**
	 * target is the destination (texture) to render to. null for canvas.
	 * range is the part (in pixels) to render to. [x_low,y_low,x_high,y_high]
	 * range is set according to the resolution and active area of target
	 */
	run() {
		const gl=this.gl;
		const program=this.program;

		// rendering target setting
		gl.useProgram(program);

		// attribute setting
		let totalTurn=Infinity;
		for(let v in this.attributeMap) { // set all attributes
			const attr=this.attributeMap[v];
			gl.bindBuffer(gl.ARRAY_BUFFER,attr.buffer);
			gl.enableVertexAttribArray(attr.location);
			gl.vertexAttribPointer(attr.location,attr.size,gl.FLOAT,false,0,0);
			if(totalTurn>attr.turn) {
				totalTurn=attr.turn;
			}
		}
		if(!isFinite(totalTurn)) { // total turns to run not specified
			totalTurn=1;
		}

		// uniform setting
		for(let v in this.uniformMap) { // set all uniforms
			const unif=this.uniformMap[v];
			switch(unif.value.length) { // could not use var proxy for gl.uniformxfv
				case 1: gl.uniform1fv(unif.location,unif.value); break; // vec1
				case 2: gl.uniform2fv(unif.location,unif.value); break; // vec2
				case 3: gl.uniform3fv(unif.location,unif.value); break; // vec3
				case 4: gl.uniform4fv(unif.location,unif.value); break; // vec4
			}
		}

		gl.bindTexture(gl.TEXTURE_2D,this.srcTexture); // set this texture as source

		// if the target needs to be cleared, it should be done before running the program
		// run program several times
		gl.drawArrays(gl.TRIANGLES,0,totalTurn);
	}

	// statics
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
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
		return texture;
	}

	/**
	 * s1,s2 contains {width,height,left,top}
	 * return a new {width,height,left,top} containing both s1 & s2 area.
	 * if s1 or s2 contains zero pixel (w or h is 0), its size & position will be omitted
	 */
	static extendBorderSize(s1,s2) {
		const isS1Zero=!(s1.width&&s1.height);
		const isS2Zero=!(s2.width&&s2.height);

		if(isS1Zero){
			if(isS2Zero){ // return empty
				return {width: 0, height: 0, left: 0, top: 0};
			}
			else{ // return s2
				return {width: s2.width, height: s2.height, left: s2.left, top: s2.top};
			}
		}
		else{
			if(isS2Zero){ // return s1
				return {width: s1.width, height: s1.height, left: s1.left, top: s1.top};
			}
			else{ // return combination
				const xl=Math.min(s1.left,s2.left);
				const xu=Math.max(s1.left+s1.width,s2.left+s2.width);
				const yl=Math.min(s1.top,s2.top);
				const yu=Math.max(s1.top+s1.height,s2.top+s2.height);
				return {
					width: xu-xl,
					height: yu-yl,
					left: xl,
					top: yl
				};
			}
		}
	}

	static borderIntersection(s1,s2) {
		const xL=Math.max(s1.left,s2.left);
		const yL=Math.max(s1.top,s2.top);
		const xH=Math.min(s1.left+s1.width,s2.left+s2.width);
		const yH=Math.min(s1.top+s1.height,s2.top+s2.height);
		return {
			left: xL,
			top: yL,
			width: xH-xL,
			height: yH-yL
		};
	}
}
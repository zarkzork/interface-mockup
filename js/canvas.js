$(function(){
    /* @return object containing preloaded images objects. When all images */
    /* will be loaded. this.images loaded will be true.*/
    /* TODO: add callback on images load. */
    function PreloadedImages(images, cb){
      var self=this;
      var count=images.length;
      this.images_loaded=false;
      var loaded=function (){
	count--;
	if(count==0){
	  self.images_loaded=true;
	  if(typeof cb == "function"){
	    cb();
	  }
	}
      };
      var with_error=function(){
	loaded();
	throw "error during load of image.";
      };
      for(var i in images){
	var image=images[i];
	this[image]=new Image();
	this[image].onload=loaded;
	this[image].onerror=with_error;
	this[image].onabort=with_error;
	this[image].src="img/"+image+".png";
      }
      return this;  
    }

    /* global constants describing size of feature box */
    var FEATURE_HEIGTH=110;
    var SHORT_WIDTH=100;
    var LONG_WIDTH=200;

    /* objects on scheme are representet with nodes. Each node contain  */
    /* clone of a feature and it's children which should be nodes or null  */
    /* objects */
    function Node(feature){
      this.feature=!feature?null:feature.clone();
      this.children=[];
      if(feature){
	for(var i=0;i<feature.transitions;i++){
	  this.children.push(new Node(null));
	}
      }
      return this;
    }

    Node.prototype={
      /* remove feature and its children from node */
      clear: function(){
	this.feature=null;
	this.children=[];
      },
      /* copies current node */
      clone: function(){
	var node=new Node(this.feature);
	for(var i in this.children){
	  node.children[i]=this.children[i].clone();
	}
	return node;
      },
      /* recursively determines height of node. @return integer
       representing number of objects that needs to be stored in node */
      getHeight: function(){
	if(!this.feature||this.feature.transitions==0){
	  return 1;
	}
	var height=0;
	for(var i=0;i<this.feature.transitions;i++){
	  height+=this.children[i].getHeight();
	}
	return height;
      },
      /* returns canvas with transitions. Also adds small icon
       representing each transition. If icon is absent draws a circle with
       random color */
      getCanvas: function(){
	var cnvs=Canvas("", this.getHeight()*FEATURE_HEIGTH, LONG_WIDTH);
	var ctx=cnvs[0].getContext("2d");
	var current_height=0;
	for(var i in this.children){
	  ctx.strokeStyle= "rgba(255,255,255, 1)";
	  ctx.fillStyle= "rgba(255, 255, 255, 1)";
	  ctx.beginPath();
	  var start_x=SHORT_WIDTH/2;
	  var start_y=FEATURE_HEIGTH*this.getHeight()/2;
	  /* move to start of line */
	  ctx.moveTo(start_x, start_y);
	  var end_x=LONG_WIDTH-5;
	  var end_y=current_height+
	    FEATURE_HEIGTH*this.children[i].getHeight()/2;
	  current_height+=this.children[i].getHeight()*FEATURE_HEIGTH;
	  /* draw line */
	  ctx.lineTo(end_x, end_y);
	  ctx.closePath();
	  ctx.stroke();
	  ctx.beginPath();
	  /* draw white circle at the end of line */
	  ctx.arc(end_x, end_y, 5, 0, Math.PI*2, true);
	  ctx.fill();
	  ctx.beginPath();
	  if(this.feature.options.transitions_img){
	    /* draw image in the middle of line */
	    ctx.drawImage(this.feature.options.transitions_img[i],
			  start_x+(end_x-start_x)/2-10,
			  start_y+(end_y-start_y)/2-10,
			  20,20);
	    ctx.fill();
	  }else{
	    ctx.fillStyle= "rgb"+this.feature.options.node_colors[i];
	    /* draw circle */
	    ctx.arc(start_x+(end_x-start_x)/2,
		    start_y+(end_y-start_y)/2,
		    5, 0, Math.PI*2, true);
	    ctx.fill();
	  }
	}
	return cnvs;
      }
    };

    /* place where scheme is stored. Object controls position of nodes and*/
    /* draws them to #workspace */
    function Workspace(){
      var self=this;
      /* Trash icon is used to delete elements from scheme */
      $("#trash").droppable({
			      accept:function(draggable){
				return draggable.data("node_element");
			      },
			      drop: function(e, ui){
				setTimeout(
				  function(){
				    /* node_element */
				    var n_e=
				      ui.draggable.data("node_element");
				    self.remove(n_e.node.children[n_e.pos]);
				  }, 0);
			      },
			      tolerance:"pointer"			  
			    });
      /* onclick for undo buttob */
      $("#undo").click(function(){
			 self.undo();
		       });
      this.messenger=new Messenger();
      this._history=[];
      this.root=new Node(new Feature(1,
				     {},
				     {
				       img:preloaded_images.start,
				       transitions_img:[preloaded_images.start]
				     }));
      this.draw();
      return this;
    }

    Workspace.prototype={
      /* undo last change */
      undo: function(){
	if(this._history.length>0){
	  var history_element=this._history.pop();
	  this.root=history_element.node;
	  if(history_element.message){
	    this.messenger.show("Undo: "+
				history_element.message);	
	  }
	}
	this.draw();
      },
      /* saves state of diagram to allow undo */
      saveState: function(description){
	this._history.push({node: this.root.clone(),
			    message: description});
      },
      /* remove node from workspace */
      remove: function(node){
	if(node==this.root){
	  throw "can't delete root node";
	}
	var text="node deleted";
	this.messenger.show(text);
	this.saveState(text);
	node.clear();
	this.draw();
      },
      /* append node @node -- node to be appended. @pos -- position among
       node transitions and @feature -- feature to be added. */
      append: function(node,pos,feature){
	this.saveState("node appended");
	node.children[pos]=new Node(feature);
	this.draw();
      },
      move: function(old_node, old_pos, new_node, new_pos){
	var text="Node moved";
	this.messenger.show(text);
	this.saveState(text);
	new_node.children[new_pos]=old_node.children[old_pos];
	old_node.children[old_pos]=new Node(null);
	this.draw();
      },
      /* Places transitions in the right place on #workspace */
      drawTransition: function(node, deep, height){
	var transitions=node.getCanvas();
	var left_pos=deep*LONG_WIDTH-deep*SHORT_WIDTH/2;
	transitions
	  .css("position","absolute")
	  .css("top", height*FEATURE_HEIGTH)
	  .css("left", left_pos);
	this.getNodeToAppend(deep, height).append(transitions);
      },
      /* Places Feature in the rigth place of the #workspace */
      drawFeature: function(node, deep, height){
	var self=this;
	var left_pos=deep*LONG_WIDTH-deep*SHORT_WIDTH/2;
	var feature;
	if(node==this.root){
	  feature=node.feature.getCanvas();
	}else{
	  feature=node.feature.getCanvas();
	  feature.dblclick(function(){
			     var menu=new Menu(node, self);
			     menu.showMenu();
			   });
	}
	var feature_top=(node.getHeight()/2+height)*FEATURE_HEIGTH
	  -FEATURE_HEIGTH/2;
	feature
	  .css("position","absolute")
	  .css("top", feature_top)
	  .css("left", left_pos);
	this.getNodeToAppend(deep, height).append(feature);      
      },
      /* Draws a box which is used as container that gets droppable
       objects (see jquery droppable and draggable). @i -- position in the
       node to which dropped feature will be appended. for other params see
       this.draw() */
      drawBox: function(i, node, deep, height){
	var self=this;
	var left_pos=deep*LONG_WIDTH-deep*SHORT_WIDTH/2;
	var droppable=$("<div/>")
	  .css("position","absolute")
	  .addClass("border")
	  .css("height", FEATURE_HEIGTH)
	  .css("top", height*FEATURE_HEIGTH)
	  .css("left", left_pos+SHORT_WIDTH+SHORT_WIDTH/2)
	  .css("width", SHORT_WIDTH)
	  .html("&nbsp;");
	/* preventing closure in drop function */
	(function(i,node,droppable){
	   droppable.droppable({
				 drop:function(e, ui){
				   /* This uses setTimeout with 0
				    timeout. As workspace.draw() removes
				    droppable and future event processing
				    uses droppable we need to allow event
				    to be processed */
				   setTimeout(
				     function(){
				       var feature=
					 ui.draggable.data("feature");
				       if(feature){
					 self.append(node,
						     i,
						     feature);
				       }else{
					 var node_element=
					   ui.draggable.data("node_element");
					 self.move(node_element.node,
						   node_element.pos,
						   node,
						   i);
				       }
				     }, 0);
				 },
				 /* as nested elements could be so big */
				 tolerance:"pointer"
			       });	     
	 })(i,node,droppable);
	this.getNodeToAppend(deep+1, height).append(droppable);    
      },
      /* Draws whole tree on the workspace. Should be used without
       args. function recursively calls itself to draw each node */
      draw: function(){
	/* if there is no arguments call self with root node */
	if(arguments.length==0){
	  $("#diagram").empty();
	  $("#diagram").css("height", this.root.getHeight()*FEATURE_HEIGTH);
	  return this.draw(this.root,0,0);
	}else{
	  /* node to be drawn */
	  var node=arguments[0];
	  /* level of deepness (left shift) */
	  var deep=arguments[1];
	  /* current distance from top in feature heights. */
	  var height=arguments[2];
	  /* make node draggable */
	  this.getNodeToAppend(deep,height)
      	    .draggable({
			 revert: 'invalid',
			 appendTo: 'body',
			 zIndex: 10
		       });
	  /* draw transitions */
	  this.drawTransition(node,deep,height);
	  /* draw feature icon */
	  this.drawFeature(node, deep, height);
	  var used_height=0;
	  var child;
	  /* calls it self recursively adding one to deep and height */
	  for(var i in node.children){
	    /* this div allow node and it's children to be dragged */
	    var draggable=$("<div/>")
	      .attr("id","d"+(deep+1)+"h"+(height+used_height))
	      .data("node_element",{"node":node,
				    pos:i});
	    this.getNodeToAppend(deep, height)
	      .append(draggable);
	    child=node.children[i];
	    if(child.feature){
	      used_height+=this.draw(child,deep+1,height+used_height);
	    }else{
	      this.drawBox(i, node, deep, height+used_height);
	      used_height++;
	    }
	  }
	  /* set used height to 1 if node has no children */
	  if(node.children==0){
	    return 1;
	  }
	  return used_height;
	}
      },
      getNodeToAppend: function(deep, height){
	if(deep==0){
	  return $("#diagram");
	}else{
	  return $("#d"+deep+"h"+height);
	}
      }
    };

    /* pop up to set up feature parameters wich are stored in */
    /* node.properties */
    function Menu(node, workspace){
      this.node=node;
      this.properties=node.feature.properties;
      this.workspace=workspace;
      return this;
    }

    Menu.prototype={
      showMenu: function(){
	var self=this;
	var menu=$("#menu");
	menu.empty();
	var close_link=$("<a/>")
	  .addClass("close")
	  .attr("href","#")
	  .text("Close")
	  .click(function(){menu.slideUp("fast");});
	menu.append(close_link);
	var remove_link=$("<a/>")
	  .addClass("remove")
	  .attr("href","#")
	  .text("remove_node")
	  .click(function(){
		   if(confirm("Do you really want to remove node?")){
		     self.workspace.remove(self.node);
		     menu.slideUp("fast");
		   }
		 });
	menu.append(remove_link);
	for(var prop in this.properties){
	  this.addProperty(prop);
	}
	menu.slideDown("fast");

      },
      addProperty: function(property){
	var self=this;
	var menu=$("#menu");
	var label=$("<span/>")
	  .text(property);
	var input_box=$("<input type=\"text\"/>")
	  .attr( "value", this.properties[property]);
	input_box.change(
	  function(){
	    if(self.properties[property]!=$(this).attr("value")){
	      var text="parameter \""+
		property+"\" changed.";
	      self.workspace.messenger.show(text);
	      self.workspace.saveState(text);
	      self.properties[property]=$(this).attr("value");
	    }
	  });
	menu.append($("<div/>")
		    .addClass("option")
		    .append(label)
		    .append(input_box));
      }
      
    };

    /* Represents feature. @transitions -- amount of possible outputs of  */
    /* this feature, @properties -- object containing feature properties  */
    /* and @option is objects for storing feature representation. It can  */
    /* contain field 'img' which should be loaded Image objects, field  */
    /* 'transitions_img' which should be array of loaded objects, name --  */
    /* feature name.  */
    function Feature(transitions,properties,options){
      this.transitions=transitions||0;
      this.properties=properties||{};
      this.options=options||{};
      if(!options||!options.transitions_img){
	this.options.node_colors=[];
	var i=transitions;
	while(i-->0){
	  var red=Math.floor(Math.random()*255)+1;
	  var blue=Math.floor(Math.random()*255)+1;
	  var green=Math.floor(Math.random()*255)+1;
	  this.options.node_colors[i]="("+red+","+
	    blue+","+green+")";
	}
      }
      return this;
    }

    Feature.prototype={
      /* copies properties field and return new Feature with new
       properties object */
      clone: function(){
	var properties={};
	for(var i in this.properties){
	  properties[i]=this.properties[i];
	}
	return new Feature(this.transitions, properties, this.options);
      },
      /* return canvas containing feature icon */
      getCanvas: function(){
	var self=this;
	var height;
	var width;
	height=FEATURE_HEIGTH;
	width=SHORT_WIDTH;
	var top=height/2-50;
	var cnvs=Canvas("", height, width);
	var ctx=cnvs[0].getContext("2d");
	if(this.options.img){
	  ctx.drawImage(this.options.img,
			0,0,100,100);
	}else{
	  ctx.strokeStyle= "rgba(255,255,255, 0.5)";
	  ctx.fillStyle= "rgba(255, 255, 255, 0.5)";
	  ctx.fillRect ( 0, top, FEATURE_HEIGTH-10, SHORT_WIDTH);      
	}
	cnvs.data("feature",this);
	return cnvs;
      },
      /* feature box with caption on palette */
      featureBox: function (){
	var self=this;
	var canvas=this.getCanvas();
	canvas.draggable({
			   appendTo: 'body',
			   revert: 'invalid',
			   helper: function(event) {
			     return self.getCanvas();
			   },
			   start: hideHelpers
			 });
	var box=$("<div/>")
	  .addClass("featureBox")
	  .append(canvas);
	var caption=$("<div/>")
	  .addClass("caption")
	  .text(this.options.name);
	box.append(caption);
	return $("<div>").append(box);
      }
    };

    /* hides all initial screen helpers */
    function hideHelpers(){
      $(".helper").fadeOut("slow");
    }

    /* Simple function to return jQuery object with canwas in it. */
    function Canvas(id, height, width){
      return $("<canvas id=\""+id+"\""+
	       "height=\""+height+"\""+
	       "width=\""+width+"\">"+
	       "</canvas>")
	.css("height",height)
	.css("width",width);
    }

    /* palette with features that will be used to build diagram */
    function Palette(){
      this.append(new Feature(3,
			      {
				"Russian track id":4343,
				"USA track id": 686,
				"Japanese track id": 111
			      },
			      {
				img:preloaded_images.lang,
				transitions_img:[preloaded_images.rus,
						 preloaded_images.usa,
						 preloaded_images.jap],
				name:"Select language"
			      })
		 );
      
      this.append(new Feature(1,
			      {
				"Tracks to play":"4343, 342"
			      },
			      {
				img:preloaded_images.anno,
				transitions_img:[preloaded_images.ok],
				name:"Play announcement"
			      })
		 );
      
      this.append(new Feature(0,
			      {
				"Beep before drop (seconds)":15
			      },
			      {
				img:preloaded_images.drop,
				name:"Drop call"
			      })
		 );
      
      this.append(new Feature(2,
			      {
				"password":"BigSecret"
			      },
			      {
				img:preloaded_images.pin,
				transitions_img:[preloaded_images.ok,
						 preloaded_images.error],
				name:"Check pin"
			      })
		 );
      
      this.append(new Feature(0,
			      {},
			      {
				img:preloaded_images.ok,
				name:"Connect"
			      })
		 );
      
      this.append(new Feature(2,
			      {
				"block regexp":"+7495*"
			      },
			      {
				img:preloaded_images.black,
				transitions_img:[preloaded_images.ok,
						 preloaded_images.error],
				name:"Black list"
			      })
		 );
      return this;
    }

    Palette.prototype={
      append: function(feature,text){
	$("#palette ol").append($("<li/>")
				.append(feature.featureBox(text)));
      }
    };

    /* controls messages queue */
    function Messenger(){
      this.stack=[];
      this._showing=false;
      return this;
    }

    Messenger.prototype={
      show: function(text){
	if(text&&text!=""){
	  this.stack.push(text);
	  this._display();      
	}
      },
      _display: function(){
	if(!this._showing){
	  var self=this;
	  var text=this.stack.pop();
	  if(text){
	    this._showing=true;
	    $("#messages h1").text(text);
	    $("#messages").slideDown('slow',
				     function(){
				       setTimeout(
					 function(){
					   $("#messages")
					     .slideUp('fast',
						      function(){
							self._showing=false;
							self._display();
						      });
					 }, 2000);
				     });
	  }
	}
      }
    };



    var preloaded_images=new PreloadedImages(["anno",
					      "pin",
					      "black",
					      "drop",
					      "error",
					      "jap",
					      "lang",
					      "ok",
					      "rus",
					      "start",
					      "usa"],
					     function(){
					       new Palette();
					       new Workspace();
					     });

  });
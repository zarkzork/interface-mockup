$(onLoad);

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
					  "usa"]);

function PreloadedImages(images){
  var self=this;
  var count=images.length;
  this.images_loaded=false;
  var loaded=function (){
    count--;
    if(count==0){
      self.images_loaded=true;
    }
  };
  var with_error=function(){
    loaded();
    throw "error during load of image";
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

function onLoad(){
  if(!preloaded_images.images_loaded){
    setTimeout(onLoad, 20);
  }else{
    new Palette();
    new Workspace();
  }
}

var FEATURE_HEIGTH=110;
var SHORT_WIDTH=100;
var LONG_WIDTH=200;

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
  clear: function(){
    this.feature=null;
    this.children=[];
  },
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
      ctx.moveTo(start_x, start_y);
      var end_x=LONG_WIDTH-5;
      var end_y=current_height+
	FEATURE_HEIGTH*this.children[i].getHeight()/2;
      current_height+=this.children[i].getHeight()*FEATURE_HEIGTH;
      ctx.lineTo(end_x, end_y);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(end_x, end_y, 5, 0, Math.PI*2, true);
      ctx.fill();
      ctx.beginPath();
      if(this.feature.options.transitions_img){
	ctx.drawImage(this.feature.options.transitions_img[i],
		      start_x+(end_x-start_x)/2-10,
		      start_y+(end_y-start_y)/2-10,
		      20,20);
	ctx.fill();
      }else{
	ctx.fillStyle= "rgb"+this.feature.options.node_colors[i];
	ctx.arc(start_x+(end_x-start_x)/2,
		start_y+(end_y-start_y)/2,
		5, 0, Math.PI*2, true);
	ctx.fill();
      }
    }
    return cnvs;
  }
};


function Workspace(){
  this.root=new Node(new Feature(1,{},{img:preloaded_images.start}));
  this.draw();
  return this;
}

Workspace.prototype={
  remove: function(node){
    if(node==this.root){
      throw "can't delete root node";
    }
    node.clear();
    this.draw();
  },
  append: function(node,pos,feature){
    node.children[pos]=new Node(feature);
    this.draw();
  },
  draw: function(node,deep,height){
    var self=this;
    if(!node){
      $("#diagram").empty();
      $("#diagram").css("height", this.root.getHeight()*FEATURE_HEIGTH);
      return this.draw(this.root,0,0);
    }else{
      /* draw transitions */
      var transitions=node.getCanvas();
      var left_pos=deep*LONG_WIDTH-deep*SHORT_WIDTH/2;
      transitions
	.css("position","absolute")
	.css("top", height*FEATURE_HEIGTH)
	.css("left", left_pos);
      $("#diagram").append(transitions);
      /* draw box */
      var feature;
      if(node==this.root){
	feature=node.feature.getCanvas();	
      }else{
	feature=node.feature.getCanvas();
	feature.click(function(){
			var menu=new Menu(node, self);
			menu.showMenu();
		      });
      }
      var feature_top=transitions.height()/2
       	+height*FEATURE_HEIGTH
       	-FEATURE_HEIGTH/2;
      feature
       	.css("position","absolute")
       	.css("top", feature_top)
       	.css("left", left_pos);
      $("#diagram").append(feature);
      var used_height=0;
      var child;
      for(var i in node.children){
	child=node.children[i];
	if(child.feature){
	  used_height+=this.draw(child,deep+1,height+used_height);
	}else{
	  var droppable=$("<div/>")
	    .css("position","absolute")
	    .addClass("border")
	    .css("height",FEATURE_HEIGTH)
	    .css("top",(height+used_height)*FEATURE_HEIGTH)
	    .css("left",left_pos+SHORT_WIDTH+SHORT_WIDTH/2)
	    .css("width", SHORT_WIDTH)
	    .html("&nbsp;");
	  /* preventing closure in drop function */
	  (function(i,node,droppable){
	     droppable.droppable({
				   drop:function(e, ui){
				     self.append(node,
						 i,
						 ui.draggable.data("self"));
				   }
				 });	     
	   })(i,node,droppable);
	  $("#diagram").append(droppable);
	  used_height++;
	}
      }
      /* set used height to 1 if node has no children */
      if(node.children==0){
	return 1;
      }
      return used_height;
    }
  }
};

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
    input_box.change(function(){
		       self.properties[property]=
			 $(this).attr("value");
    		     });
    menu.append($("<div/>")
		.addClass("option")
		.append(label)
		.append(input_box));
  }
  
};

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
  clone: function(){
    var properties={};
    for(var i in this.properties){
      properties[i]=this.properties[i];
    }
    return new Feature(this.transitions, properties, this.options);
  },
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
    cnvs.data("self",this);
    return cnvs;
  },
  /* feature box with caption on palette */
  featureBox: function (text){
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
      .text(text);
    box.append(caption);
    return $("<div>").append(box);
  }
};

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
					     preloaded_images.jap]
			  }),
	     "Select language");
  
  this.append(new Feature(1,
			  {
			    "Tracks to play":"4343, 342"
			  },
			  {
			    img:preloaded_images.anno,
			    transitions_img:[preloaded_images.ok]
			  }),
	      "Play announcement");
  
  this.append(new Feature(0,
			  {
			    "Beep before drop (seconds)":15
			  },
			  {
			    img:preloaded_images.drop
			  }),
	      "Drop call");
  
  this.append(new Feature(2,
			  {
			    "password":"BigSecret"
			  },
			  {
			    img:preloaded_images.pin,
			    transitions_img:[preloaded_images.ok,
					     preloaded_images.error]
			  }),
	      "Check pin");
  
  this.append(new Feature(0,
			  {},
			  {
			    img:preloaded_images.ok
			  }),
	      "Connect");
  
  this.append(new Feature(1,
			  {
			    "block regexp":"+7495*"
			  },
			  {
			    img:preloaded_images.black,
			    transitions_img:[preloaded_images.ok]
			  }),
	      "Black list");
  return this;
}

Palette.prototype={
  append: function(feature,text){
    $("#palette ol").append($("<li/>")
			    .append(feature.featureBox(text)));
  }
};



/* WeLive support.js  @Copyright weensoft.cn */

var userAgent = navigator.userAgent.toLowerCase();
var isIE = window.ActiveXObject && userAgent.indexOf('msie') != -1 && userAgent.substr(userAgent.indexOf('msie') + 5, 3);

//Ajax封装
var ajax_isOk = 1;
function ajax(url, send_data, callback) {
	if(!ajax_isOk) return false;
	$.ajax({
		url: url,
		data: send_data,
		type: "post",
		cache: false,
		dataType: "json",
		beforeSend: function(){ajax_isOk = 0;$("#ajax-loader").addClass('loading');},
		complete: function(){ajax_isOk = 1;$("#ajax-loader").removeClass('loading');},
		success: function(data){
			if(callback)	callback(data);
		},
		error: function(XHR, Status, Error) {
			file_temp_data = "";
			//showInfo("Ajax错误", "", "", 8, 0);
			showInfo("Data: " + XHR.responseText + "\r\nStatus: " + Status + "\r\nError: " + Error, "", "", 8, 0);
		}
	});
}

//设置cookie
function setCookie(n,val,d) {
	var e = "";
	if(d) {
		var dt = new Date();
		dt.setTime(dt.getTime() + parseInt(d)*24*60*60*1000);
		e = "; expires="+dt.toGMTString();
	}
	document.cookie = n+"="+val+e+"; path=/";
}

//获取cookie
function getCookie(n) {
	var a = document.cookie.match(new RegExp("(^| )" + n + "=([^;]*)(;|$)"));
	if (a != null) return a[2];
	return '';
}

//将已转义的字符恢复
function html(str) {
	 return str.replace(/\\/g, '').replace(/\&amp;/g, '&').replace(/\&#039;/g, "'").replace(/\&quot;/g, '"').replace(/\&lt;/g, '<').replace(/\&gt;/g, '>');
}

//新消息闪动页面标题
function flashTitle() {
	clearInterval(tttt);
	flashtitle_step=1;
	tttt = setInterval(function(){
		if (flashtitle_step==1) {
			document.title='【新消息】'+pagetitle;
			flashtitle_step=2;
		}else{
			document.title='【　　　】'+pagetitle;
			flashtitle_step=1;
		}
	}, 500);
}

//停止闪动页面标题
function stopFlashTitle() {
	if(flashtitle_step != 0){
		flashtitle_step=0;
		clearInterval(tttt);
		document.title=pagetitle;

		//判断未读是否为0, 不为0则发送已读信号, 且未离线时
		if(CurrentId && CurrentUnread && $.inArray(CurrentId, offline) < 0){
			CurrentUnread = 0;
			welive_send({type: "s_readed", gid: CurrentId});
		}
	}
}

//获得计算机当前时间
function getLocalTime() {
	var date = new Date();

	function addZeros(value, len) {
		var i;
		value = "" + value;
		if (value.length < len) {
			for (i=0; i<(len-value.length); i++)
				value = "0" + value;
		}
		return value;
	}
	return addZeros(date.getHours(), 2) + ':' + addZeros(date.getMinutes(), 2) + ':' + addZeros(date.getSeconds(), 2);
}

//显示提示信息 callback表示对话框关闭时执行的函数; success表示是成功信息还是错误信息; time是自动关闭时间(秒)
function showInfo(info, title, callback, time, success){
	var ti = time? time * 1000 : 0;

	if(success){
		var title = "<font color=#33CC00>" + (title? title : "系统信息") + "</font>";
		var content = "<font color=blue>" + info + "</font>";
	}else{
		var title = "<font color=red>" + (title? title : "系统信息") + "</font>";
		var content = "<font color=#FF9900>" + info + "</font>";
	}

	easyDialog.open({
		container:{
			header: title,
			content: content,
			yesFn:function(){},
			yesText: '确定'
		},
		autoClose:ti,
		callback: callback
	});

	$("#easyDialogYesBtn").focus(); //确定按钮获得焦点
}

//显示确认操作对话框 callback表示按确定时执行的函数; time是自动关闭时间;
function showDialog(info, title, callback, time){
	var ti = time? time * 1000 : 0;

	easyDialog.open({
		container:{
			header: "<font color=red>" + (title? title : "系统信息") + "</font>",
			content: "<font color=#FF9900>" + info + "</font>",
			yesFn: callback,
			yesText: '确定',
			noFn:true,
			noText: '取消'
		},
		autoClose:ti
	});

	$("#easyDialogYesBtn").focus(); //确定按钮获得焦点
}


//顶部下拉菜单 b为参数对象, c为下拉菜单显示后的事件函数
(function(a) {
	a.fn.Jdropdown = function(b, c) {
		if (this.length) {
			"function" == typeof b && (c = b, b = {});
			var d = a.extend({
					event: "mouseover",
					current: "hover",
					delay: 0
				}, b || {}),
				e = "mouseover" == d.event ? "mouseout" : "mouseleave";
			a.each(this, function() {
				var b = null,f = null,g = !1;
				a(this).bind(d.event, function() {
					if (g) clearTimeout(f);
					else {
						var e = a(this);
						b = setTimeout(function() {
							e.addClass(d.current), g = !0, c && c(e)
						}, d.delay);
					}
				}).bind(e, function() {
					if (g) {
						var c = a(this);
						f = setTimeout(function() {
							c.removeClass(d.current), g = !1
						}, 0)
					} else clearTimeout(b);
				});
			});
		}
	}
})(jQuery);


//创建窗口
function createWin(id, title, recs, lang, au){

	if($("#win_" + id)[0]) return; //小窗口存在时返回

	var x = x_win_content.replace('888888', recs);
	myWin88.Create(id, title, x, lang, au);
}

//关闭离线的访客
function shutGuest(event, id){
	event.stopPropagation();
	event.preventDefault();

	id = parseInt(id);
	if(id == CurrentId) CurrentId = 0; //如果是当前窗口
	if($.inArray(id, offline) > -1) guest_delete(id); //如客人离线, 删除所有信息

	return false;
}

//打开窗口
function openWin(id){myWin88.Show(id);}

//关闭窗口
function closeWin(id){myWin88.Min(id);}

function WeLiveWin() {
	this.Create = function(id, title, wbody, lang, au){

		var mywin = document.createElement("DIV");
		mywin.setAttribute("id", "win_" + id);
		mywin.className = "x-win";
		mywin.onmouseup = function(){openWin(id);};
		mywin.style.zIndex = zIndex;
		document.body.appendChild(mywin);
		var mytitle = document.createElement("DIV");
		var mybody = document.createElement("DIV");
		var mybottom = document.createElement("DIV");
		mytitle.className = "x-title";
		mybody.className = "x-body";
		mybottom.className = "x-bottom";
		mywin.appendChild(mytitle);
		mywin.appendChild(mybody);
		mywin.appendChild(mybottom);

		var winbody, g_tools, wintag = [mytitle, mytitle, mytitle, mybody, mybody, mybody, mybottom, mybottom, mybottom];
		for (var i = 0; i < 9; i++)	{
			var temp = document.createElement("DIV");
			wintag[i].appendChild(temp);

			if (i == 0) {
				temp.className = "x-titleleft";
			} else if (i == 1) {
				temp.className = "x-titlemid";
			} else if (i == 2) {
				temp.className = "x-titleright";
			} else if (i == 3) {
				temp.className = "x-bodyleft";
			} else if (i == 4) {
				temp.className = "x-bodymid";
				winbody = temp;
			} else if (i == 5) {
				temp.className = "x-bodyright";
			} else if (i == 6) {
				temp.className = "x-bottomleft";
			} else if (i == 7) {
				temp.className = "x-bottomid";
			} else if (i == 8) {
				temp.className = "x-bottomright";
			}

			if(i != 4 && i != 2) temp.onmousedown = function(e){myWin88.Move(mywin, e);};
		}

		mytitle.childNodes[1].innerHTML = '<div class="x-user">' + title + '&nbsp;</div><div id="min168" class="x-min" onclick="closeWin('+ id + ');" title="最小化" onMouseover="this.className=\'x-min2\';" onMouseout="this.className=\'x-min\';"></div>';
		mybody.childNodes[1].innerHTML = wbody;

		if(guest_win_mode == "multi"){
			var l = guest.length == 1 ? parseInt($(window).width()/2 - 275) : parseInt(340+Math.random() * ($(window).width() - 1250));
			var t = guest.length == 1 ? parseInt($(window).height()/2 - 290) : parseInt(46+Math.random() * ($(window).height() - 680));
		}else{
			var l = parseInt($(window).width()/2 - 275);
			var t = parseInt($(window).height()/2 - 290);
		}

		this.Move_e(mywin, l, t);

		$(winbody).children(".g_history").welivebar(); //创建滚动条
		$(winbody).children(".g_bott").children(".g_msg").keydown(function(e){if(e.keyCode ==13){guest_send();e.preventDefault();}else{search_phrases(this);}}); //输入框enter发送
		g_tools  = $(winbody).children(".g_tools");

		g_tools.children(".t_smilies").tipTip({content: $(".smilies_div").html().replace(/towhere/ig, id), keepAlive:true, maxWidth:"250px", defaultPosition:"top", left: -102, arrowLeft: -108, edgeOffset:0, delay:300, parent: true, hoverClass: "hover"});

		g_tools.children(".t_phrase").tipTip({content: "xxx", enter: function(){get_phrase(id, lang);}, keepAlive:true, maxWidth:"420px", defaultPosition:"top", left: -23, arrowLeft: -152, edgeOffset:0, delay:400, parent: true, hoverClass: "hover"});

		g_tools.children(".t_authupload").tipTip({content: '<input class="save" type="submit" value="授权上传" onclick="guest_authupload();return false;">', activation:"click", keepAlive:true, maxWidth:"348px", defaultPosition:"top", edgeOffset:4, delay:200, hoverClass: "hover"});

		g_tools.children(".t_kickout").tipTip({content: '<input class="save" type="submit" value="确定踢出" onclick="guest_kickout();return false;">', activation:"click", keepAlive:true, maxWidth:"348px", defaultPosition:"top", edgeOffset:4, delay:200, hoverClass: "hover"});

		g_tools.children(".t_banned").tipTip({content: '<input class="save" type="submit" value="确定禁言" onclick="guest_banned();return false;">', activation:"click", keepAlive:true, maxWidth:"348px", defaultPosition:"top", edgeOffset:4, delay:200, hoverClass: "hover"});

		g_tools.children(".t_transfer").tipTip({content: '<div class="s_transfer">&nbsp;</div>', enter: function(){get_supporters();}, activation:"click", keepAlive:true, maxWidth:"330px", defaultPosition:"top", left: 144, arrowLeft: 26, edgeOffset:0, delay:0, parent: true, hoverClass: "hover"});

		g_tools.children(".t_authupload").show();

	};

	this.Show = function(id){
		id = parseInt(id);

		welive.where = 1; //1客人区   0群聊区
		s_title.addClass("off"); //客服区标题变灰

		var o = $('#win_' + id);

		g_online.children("div.curr").removeClass("curr"); //先取消其它当前访客状态
		g_online.children("#gst_" + id).addClass("curr");

		if(id != CurrentId){
			o.css({visibility: 'visible', 'z-index': ++zIndex});

			var g = g_online.find("#gst_" + id + ">>b");

			//判断未读是否为0, 不为0则发送已读信号, 且未离线时
			if($.inArray(id, offline) < 0 && parseInt(g.html())){
				welive_send({type: "s_readed", gid: id});
			}

			//标记当前访客, 隐藏未读信息数;
			g.html(0).hide();

			if(guest_win_mode == "multi"){
				$('#win_' + CurrentId).find('.x-user').removeClass("x-now");
			}else{
				$('#win_' + CurrentId).css('visibility', 'hidden').find('.x-user').removeClass("x-now");
			}

			CurrentId = id;
			o.find('.g_msg').focus(); //输入框获得焦点
			o.find('.x-user').addClass("x-now");
		}else if(!o.find('.x-user').hasClass("x-now")){
			o.find('.g_msg').focus();
			o.find('.x-user').addClass("x-now");
		}
    };

    this.Min = function(id){
		CurrentId = 0; //每次关闭小窗口时, 先将当前窗口ID设置为0

		id = parseInt(id);

		if($.inArray(id, offline) > -1) {//如客人离线, 删除所有信息
			guest_delete(id);
		}else{
			$('#win_' + id).css('visibility', 'hidden');
		}
		showLast(); //显示最上一个小窗口
    };

    this.Move = function(o, evt)
    {
        if (!o) return;
	    evt = evt ? evt : window.event;
	    var obj = evt.srcElement ? evt.srcElement : evt.target;
	    if (obj.id == "min168") return;
	    var w = o.offsetWidth;
	    var h = o.offsetHeight;
	    var l = o.offsetLeft;
	    var t = o.offsetTop;

	    var div = document.createElement("DIV");
	    document.body.appendChild(div);
		div.className = "x-drag";
	    div.style.cssText = "top:"+t+"px;left:"+l+"px;";
		this.Move_r(div, o, evt);
    };

    this.Move_r = function(o, win, evt)
    {
	    o.style.zIndex = zIndex + 1;
	    evt = evt ? evt : window.event;
	    var relLeft = evt.clientX - o.offsetLeft;
	    var relTop = evt.clientY - o.offsetTop;
	    if (!window.captureEvents){
	    	o.setCapture(); 
	    }else{
	    	window.captureEvents(Event.MOUSEMOVE|Event.MOUSEUP);
		}
	    document.onmousemove = function(e)
	    {
	    	if (!o) return;
			window.getSelection ? window.getSelection().removeAllRanges() : document.selection.empty();//此行解决拖动窗口发生选中文本的问题
		    e = e ? e : window.event;
			var xleft = e.clientX - relLeft;
			var xtop = e.clientY - relTop;
			var xw = $(window).width() - o.offsetWidth - 2;
			var xh = $(window).height() - o.offsetHeight - 2;

		    if (xleft <= 1){
			    o.style.left = "1px";
		    }else if (xleft >= xw){
			    o.style.left = xw +"px";
		    }else{
			    o.style.left = xleft +"px";
			}
		    if (xtop <= 1){
			    o.style.top = "1px";
		    }else if (xtop >= xh){
			    o.style.top = xh +"px";
		    }else{
			    o.style.top = xtop +"px";
			}
	    };
	    document.onmouseup = function()
	    {
	    	if (!o) return;
	    	if (!window.captureEvents){
		    	o.releaseCapture(); 
	    	}else{
		    	window.releaseEvents(Event.MOUSEMOVE|Event.MOUSEUP);
			}
		    myWin88.Move_e(win, o.offsetLeft, o.offsetTop);
			var id = win.id.replace(/win_/ig,"");
			if(id != CurrentId) {
				openWin(id);
			}else{
				welive.where = 1; //1客人区   0群聊区
				s_title.addClass("off"); //客服区标题变灰

				var w = $('#win_' + id);

				if(!w.find('.x-user').hasClass("x-now")){
					w.find('.x-user').addClass("x-now");
				}

				w.find('.g_msg').focus();

				//更新访客列表选中状态
				g_online.children("div.curr").removeClass("curr");
				g_online.children("#gst_" + id).addClass("curr");
			}

		    document.body.removeChild(o);
		    o = null;
	    };
    };

    this.Move_e = function(o, l, t){
	    if (!o) return;
		o.style.left = l +"px";
		o.style.top = t +"px";
    };
}

//找到在最上面一个窗口id, 切换为当前
function showLast() {
	var o, oz, xId = 0, xIndex = 0;

	$.each(guest, function(i, gid){
		o = $('#win_' + gid);
		if(o.length && o.css("visibility") == 'visible') {
			oz = parseInt(o.css("z-index"));
			if (oz > xIndex) {
				xId = gid;
				xIndex = oz;
			}
		}
	});

	if(xId){
		openWin(xId);
	}else{
		g_online.children("div.curr").removeClass("curr"); //取消当前访客状态
		s_msg.focus(); //如果没有小窗口, 切换到群聊区
	}
}

//找到已打开且zIndex最小的窗口, 切换为当前. 参数hide: 表示隐藏的窗口
function showNext(hide) {
	var o, oz, xId = 0, xIndex = 1000000000, xxx = hide ? "hidden" : "visible";
	$.each(guest, function(i, gid){
		o = $('#win_' + gid);
		if(o.length && o.css("visibility") == xxx) {
			oz = parseInt(o.css("z-index"));
			if (oz < xIndex) {
				xId = gid;
				xIndex = oz;
			}
		}
	});

	if(xId){
		openWin(xId);
	}else if(CurrentId) {
		openWin(CurrentId);
	}
}

//格式化输出信息
function format_output(data) {
	//生成URL链接
	data = data.replace(/((((https?|ftp):\/\/)|www\.)([\w\-]+\.)+[\w\.\/=\?%\-&~\':+!#;]*)/ig, function($1){return getURL($1);});
	//将表情代码换成图标路径
	data = data.replace(/\[:(\d*):\]/g, '<img src="' + SYSDIR + 'public/smilies/$1.png">').replace(/\\/g, '');
	return data;
}

//格式化生成URL
function getURL(url, limit) {
	if(!limit) limit = 60;
	var urllink = '<a href="' + (url.substr(0, 4).toLowerCase() == 'www.' ? 'http://' + url : url) + '" target="_blank" title="' + url + '">';
	if(url.length > limit) {
		url = url.substr(0, 30) + ' ... ' + url.substr(url.length - 18);
	}
	urllink += url + '</a>';
	return urllink;
}

//插入表情符号
function insertSmilie(code, towhere) {
	code = '[:' + code + ':]';
	if(towhere){
		openWin(towhere);
		var obj = $("#win_" + towhere).find(".g_msg")[0];
		if(!obj) return;
	}else{
		var obj = s_msg[0];
	}
	var selection = document.selection;
	obj.focus();

	if(typeof obj.selectionStart != 'undefined') {
		var opn = obj.selectionStart + 0;
		obj.value = obj.value.substr(0, obj.selectionStart) + code + obj.value.substr(obj.selectionEnd);
	} else if(selection && selection.createRange) {
		var sel = selection.createRange();
		sel.text = code;
		sel.moveStart('character', -code.length);
	} else {
		obj.value += code;
	}
}

//插入常用短语
function insertPhrase(me, towhere) {
	var code = $(me).children("b").html();

	openWin(towhere);
	var obj = $("#win_" + towhere).find(".g_msg")[0];
	if(!obj) return;

	if(phrase_search){
		search_result_hide();
		obj.value = code;
		return;
	}

	var selection = document.selection;
	obj.focus();

	if(typeof obj.selectionStart != 'undefined') {
		var opn = obj.selectionStart + 0;
		obj.value = obj.value.substr(0, obj.selectionStart) + code + obj.value.substr(obj.selectionEnd);
	} else if(selection && selection.createRange) {
		var sel = selection.createRange();
		sel.text = code;
		sel.moveStart('character', -code.length);
	} else {
		obj.value += code;
	}

	$("#tiptip_holder").hide();
}


//socket连接
function welive_link(){
	welive.ws = new WebSocket(WS_HEAD + WS_HOST + ':'+ WS_PORT);
	welive.ws.onopen = function(){setTimeout(welive_verify, 100);}; //连接成功后, 小延时再验证用户, 否则IE下刷新时发送数据失败
	welive.ws.onclose = function(){welive_close();};
	welive.ws.onmessage = function(get){welive_parseOut(get.data);};
}

//闪烁标题和声音
function TitleSound(x){
	if(welive.flashTitle && x){
		flashTitle();
		if(welive.sound) sounder.html(welive.sound1);
		welive.flashTitle = 0;
	}else if(welive.flashTitle){
		//flashTitle(); //群聊不闪标题
		if(welive.sound) sounder.html(welive.sound2);
		welive.flashTitle = 0;
	}
}

//清空过长客服对话记录(保留50条)
function welive_clear(){
	var rec = s_history.children("div");
	var len = rec.length;
	if(len >= 100){
		rec.slice(0, len - 50).remove();
		s_hwrap.welivebar_update('bottom');
	}
}

//更新客服数量(在原数量上加或减n)
function admins_update(n){
	var x = parseInt(s_admins.html());
	x = x + n;
	if(x < 0) x = 0;
	s_admins.html(x);
}

//更新客服新消息统计-显示
function s_chat_update(){
	if(s_chat_isopen) return;

	var o = s_chat_num.children("b");
	var x = parseInt(o.html()) + 1;

	if(x > 999){
		x = "999..";
	}else{
		x = "+" + x;
	}

	o.html(x);
}


//解析数据并输出
function welive_parseOut(data){
	var gid = 0, d = false, type = 0, data = $.parseJSON(data);

	if(data.g) data.g = parseInt(data.g); //统一将访客id转为数字

	switch(data.x){
		case 4:  //客人实时输入状态
			switch(data.a){
				case 1:
					welive_runtime(data.g, data.i);
					break;

				case 2: //删除当前的输入状态
					$("#win_" + data.g).find(".overview>div.updating").remove(); //删除输入状态

					break;
			}

			return;
			break;

		case 1: //客服对话
			var time = getLocalTime();
			if(data.aid == admin.id){ //自己的发言
				d = '<div class=me><u>' + admin.fullname + ' - ' + data.p + '</u><i>' + time + '</i><br>' + format_output(data.i) + '</div>';
			}else{
				welive.flashTitle = 1;
				d = '<div' + ((data.t==1 || data.t==2)? ' class=a' : '') + '><u>' + data.n + ' - ' + data.p + '</u><i>' + time + '</i><br>' + format_output(data.i) + '</div>';
			}
			break;

		case 2: //客服特别操作及反馈信息
			switch(data.a){
				case 1: //上线
					d = '<div class=i><b></b>' + data.n + ' 上线了</div>';
					
					var status = '';
					welive.flashTitle = 1;

					if(data.fr == 1) status = '<u></u>';

					s_online.append('<li id="' + data.ix + '" title="' + data.p + '"><div><img src="' + SYSDIR + 'avatar/' + data.av + '" title="服务中...">' + status + '</div><i' + ((data.t==1 || data.t==2)? ' class=a' : '') + '>' + data.n + '</i></li>');
					s_owrap.welivebar_update(); //更新滚动条
					admins_update(1);
					break;

				case 2: //离线

					//解决客服重复连接时, 给新连接的窗口发送自己离线信息的问题(也就是说自己无法看到自己离线)
					if(data.aid == admin.id) return;

					d = '<div class=i><b></b>' + data.i + ' 已离线</div>';
					s_online.find("#" + data.ix).remove();
					s_owrap.welivebar_update(); //更新滚动条
					admins_update(-1);
					break;

				case 3: //挂起
					welive.flashTitle = 1;
					var a = s_online.find("#" + data.ix);
					d = '<div class=i><b></b>' + a.children("i").html() + ' 已挂起</div>';
					a.children("div").append('<b></b>');
					a.children("div").children("img").attr('title', '已挂起');

					if(data.ix == welive.index){
						$(".set_busy").hide();
						$(".set_serving").show();
					}
					break;

				case 4: //解除挂起
					var a = s_online.find("#" + data.ix);
					d = '<div class=i><b></b>' + a.children("i").html() + ' 解除挂起</div>';
					a.children("div").children("b").remove();
					a.children("div").children("img").attr('title', '服务中...');

					if(data.ix == welive.index){
						$(".set_serving").hide();
						$(".set_busy").show();
					}
					break;

				case 5: //获取客人信息
					gid = data.g;

					if(typeof data.d == "object"){ //返回的客人数据存在时
						var g_note = $("#win_" + gid).find(".g_note");
						if(g_note.length){
							g_note.find("a.fromurl").attr("href", data.d.fromurl.replace(/\&amp;/g, '&')).html(data.d.fromurl);
							g_note.find(".ipzone").html(data.d.ipzone + " ( " + data.d.lastip + " )");

							g_note.find("input[name=grade][value=" + data.d.grade + "]").attr("checked", true);
							g_note.find("input[name=fullname]").val(html(data.d.fullname));
							g_note.find("input[name=phone]").val(html(data.d.phone));
							g_note.find("input[name=email]").val(html(data.d.email));
							g_note.find("input[name=address]").val(html(data.d.address));
							g_note.find("textarea[name=remark]").val(html(data.d.remark));

							g_note.attr("loaded", 1); //设置数据已更新
						}
					}

					break;

				case 6: //保存客人信息后返回的结果
					gid = data.g; type = 3; d = '此客人信息保存成功!';

					var o = $("#win_" + gid);
					o.find(".g_note").hide();
					o.find(".t_note").removeClass("hover");

					if(data.n != ''){ //客人有姓名时, 更新之
						var ipzone = g_online.find("#gst_" + gid + ">s").html();
						g_online.children("#gst_" + gid).attr("title", data.n + " (" + ipzone + ")").find("i").html(data.n);
						o.find(".x-user").html(data.n);
					}

					break;

				case 7: //重复连接返回的指令
					welive.status = 0;
					welive.autolink = 0;

					clearInterval(ttt_1); //停止发送心跳数据
					clearTimeout(welive.ttt); //停止重连

					s_online.html(""); //清空客服在线列表
					s_admins.html(0); //将客服在线人数清0

					g_online.html(""); //清空客人在线列表
					$(".x-win").remove(); //清除所有客人小窗口

					welive_output('<div class="i"><b></b><font color=red>当前客服已在其它页面登录, 此页面已废弃!!</font></div>');

					break;

				case 8: //客服连接验证成功
					d = '<div class=i><b></b>服务器连接成功!</div>';
					welive.index = data.ix; //socket连接索引值
					s_hwrap.removeClass('loading3');

					welive.status = 1;
					welive.flashTitle = 1;

					//更新自己的客服列表
					var num = 0, status;

					welive.is_robot = 0; //记录无人值守是否开启

					$.each(data.al, function(n, a){
						num += 1;
						if(a.b == 1){
							status = 'title="已挂起"><b></b>';
						}else{
							status = 'title="服务中...">';
						}
 						if(a.fr == 1) status += '<u></u>';

						if(a.id == admin.id) admin.aix = a.ix; //记录自己的连接索引值

						s_online.append('<li id="' + a.ix + '" title="' + a.p + '"><div><img src="' + SYSDIR + 'avatar/' + a.av + '" ' + status + '</div><i' + ((a.t==1 || a.t==2)? ' class=a' : '') + '>' + a.n + '</i></li>');
					});

					s_owrap.welivebar_update(); //更新滚动条
					admins_update(num); //更新客服人数
					s_msg.focus(); //群聊输入框获焦点

					//客服特殊原因断线后上线(重连)，有客人时清除所有客人
					if(guest.length){
						guest = new Array();
						offline = new Array();
						guest_num_update();
						g_online.html("");
						$(".x-win").remove();
						CurrentId = 0;
						CurrentUnread = 0;
						zIndex = 2000;
					}

					//重建所有在线客人
					$.each(data.gl, function(i, guest){
						guest_create(parseInt(guest.g), guest.oid, guest.n, guest.l, guest.re, parseInt(guest.au), parseInt(guest.mb), guest.iz, guest.fr, 1); //创建已连接的客人, 在创建中输出信息, 参数1客服重新连接
					});


					$(".set_busy").click(function(e) {
						showDialog('确定挂起吗?<br>注: 挂起后, 将不再接受新客人加入.<br>但是, 转接过来的客人仍会加入.', '', function(){
							welive_send({type: "s_handle", operate: "hangup", value: 1}); //发送挂起请求
						});

						e.preventDefault();
					});

					$(".set_serving").click(function(e) {
						welive_send({type: "s_handle", operate: "hangup", value: 0}); //发送解除挂起请求
						e.preventDefault();
					});

					//开启无人值守
					$(".set_robot_on").click(function(e) {
						showInfo("免费版无此功能!", "系统信息", "", 3, 0);
						e.preventDefault();
					});

					//判断当前无人值守状态及按钮状态
					$(".set_robot_on").show();
					$(".set_robot_off").hide();

					//启动心跳, 即每隔26秒自动发送一个特殊信息, 解决IE下30秒自动断线的问题
					ttt_1 = setInterval(function() {						
						welive_send({type:"ping"}); //只要连接状态, 均要发送心跳数据, 设置一个怪异的数字避免与自动离线的时间间隔重合, 避免在同一时间点上send数据上可能产生 -----幽灵bug
					}, 26125);

					break;

			}

			break;

		case 5:  //客人与客服对话
			gid = data.g;
			d = data.i;
			if(data.a == 1){
				type = 1; //自己发出的对话
			}else{
				welive.flashTitle = 1; //声音等
				type = 2; //客人发来的
			}

			break;

		case 6: //客服特别操作及反馈信息
			switch(data.a){
				case 8: //客人登录成功
					guest_create(data.g, data.oid, data.n, data.l, data.re, parseInt(data.au), parseInt(data.mb), data.iz, data.fr); //创建新客人, 在创建中输出信息

					break;

				case 3: //客人离线
					gid = data.g; type = 4; d = '此客人已离线!';

					if(!gid || $.inArray(gid, guest) < 0 || $.inArray(gid, offline) > -1) return; //被踢出时, 返回, 否则js出错

					offline.push(gid); //添加到离线客人数组中
					guest_num_update(); //更新访客人数统计显示

					g_online.children('#gst_' + gid).addClass("offline");
					var o = $("#win_" + gid).find(".x-user");
					o.html(o.html() + ' -- 已离线');

					break;

				case 11: //转接客人返回信息
					if(data.i == 1){ //转接成功
						gid = data.g; type = 3; d = '此客人转接成功.';
						offline.push(gid); //添加到离线客人数组中
						guest_num_update(); //更新访客人数统计显示

						g_online.children('#gst_' + gid).addClass("offline");
						var o = $("#win_" + gid).find(".x-user");
						o.html(o.html() + ' -- 已转接');
					}else{
						gid = data.g; type = 4; d = '此客人转接失败!';
					}

					break;

				case 13: //客人请求回拨电话
					gid = data.g;
					welive.flashTitle = 1; //声音等
					type = 2; //客人发来的

					d = '<div class="spec_info">' + data.i + '</div>';

					break;
			}

			break;
	}

	welive_output(d, gid, type); //输出
}


//显示大图片
function show_big_img(me, width, height){
	if(width/height >= 1200/700){
		var d_w = width;
		if(d_w > 1200) d_w = 1200;
		if(width < 1) width = 1;
		var d_h = height * d_w / width;
	}else{
		var d_h = height;
		if(d_h > 700) d_h = 700;
		if(height < 1) height = 1;
		var d_w = width * d_h / height;
	}

	easyDialog.open({
		container:{
			header: "图片",
			content: '<img src="' + me.src + '" style="width: ' + d_w + 'px;height: ' + d_h + 'px;" onclick="easyDialog.close();return false;">',
		},
		width: d_w + 20,
		height: d_h + 20,
		//lock: true, //禁用ESC键关闭, 因为ESC已经用于关闭客人小窗口
	});
}


//创建客人: 当客服刷新页面或断线重连时old = 1; recs指对话历史记录; au=上传授权authupload
function guest_create(gid, oid, n, lang, recs, au, mb, iz, fr, old){
	if(!gid) return;

	welive.flashTitle = 1;
	var d, index_guest = $.inArray(gid, guest), index_offline = $.inArray(gid, offline);

	if(n == '') n = ((lang == 1)? '访客 '  : 'Guest ') + gid;

	//原网站id
	if(oid != "" && oid != "0" && oid != 0){
		n = n + " - Oid: " + oid;
	}

	//来自URL
	if(fr){
		fr = ', 来自:<br>' + fr;
	}else{
		fr = '!';
	}

	if(index_guest > -1 && index_offline > -1){ //表示客人重新上线
		d = '此客人重新上线了' + fr;
		offline.splice(index_offline, 1); //将其从离线数组中删除
		guest_num_update(); //更新访客人数统计显示
		welive.flashTitle = 0; //重新上线无声音不闪烁

		var g_win = $("#win_" + gid);

		//更新用户名
		g_win.find(".x-user").html(n);
		g_online.children('#gst_' + gid).removeClass("offline").find("i").html(n);

		//更新客人上传权限图片状态
		g_win.find(".t_offupload").hide();
		g_win.find(".t_authupload").show();

		//恢复禁言按钮
		g_win.find(".t_unban").hide();
		g_win.find(".t_banned").show();

	}else if(index_guest < 0 && index_offline < 0){ //新客人
		guest.push(gid);

		guest_num_update(); //更新访客人数统计显示

		g_online.prepend('<div id="gst_' + gid + '" onclick="openWin(' + gid + ');" class="g" title="' + n + ' (' + iz + ')"><div>' + ((mb == 1)? '<u></u>'  : '') + '<b>0</b></div><s>' + iz + '</s><i>' + n + '</i><a onclick="shutGuest(event, ' + gid + ')">X</a><p></p></div>');

		if(old === 1){ //指客服重新上线
			d =  admin.fullname + ' 重新上线, 已通知客人';
		}else{
			d = '客人上线, 问候语已发送' + fr;
		}

		var recs_html = '';

		$.each(recs, function(i, rec){

			//上传图片的记录
			if(rec.ft == 1){
				var img_arr = rec.m.split("|");
				var img_w = parseInt(img_arr[1]);
				var img_h = parseInt(img_arr[2]);

				if(img_w < 1) img_w = 1;
				var img_h_new = parseInt(img_h * 200 / img_w); //CSS样式中已确定宽度为200

				var rec_i = '<img src="' + SYSDIR + 'upload/img/' +img_arr[0] + '" class="receive_img" style="height:' + img_h_new + 'px;" onclick="show_big_img(this, ' + img_w + ', ' + img_h + ');">';

			//上传的文件记录
			}else if(rec.ft == 2){
				var file_arr = rec.m.split("|");
				var rec_i = '<a href="' + SYSDIR + 'upload/file/' + file_arr[0] + '" target="_blank" download="' + file_arr[1] + '"><img src="' + SYSDIR + 'public/img/save.png">&nbsp;&nbsp;点击下载: ' +  file_arr[1] + '</a>';
			}else{
				var rec_i = format_output(rec.m);
			}

			var position = "l"; //默认为客人的记录
			if(rec.t == 1)	position = "r"; //客服的记录

			recs_html += '<div class="msg ' + position + '"><b></b><div class="b"><div class="i">' + rec_i + '</div></div><i>' + rec.d + '</i></div>';

		});

		if(recs_html != '') recs_html += '<div class="msg s"><div class="b"><div class="ico"></div><div class="i">... 以上为最近对话记录.</div></div></div>';;

		createWin(gid, n, recs_html, lang, au); //创建窗人小窗口

	}else{ //客人重复连接
		welive.flashTitle = 0;
		return;
	}

	guest_output(d, gid, 3); //给客人小窗口输出信息
}

//客人移动到最前面
function guest_movetop(gid){
	var cur_g = g_online.children('#gst_' + gid); //当前访客
	var prev_g = cur_g.prev(); // 获取当前节点的上一个节点

	if(prev_g.length > 0){
		g_online.children(":first").before(cur_g);
	}
}

//更新访客人数统计-显示
function guest_num_update(){
	guest_div.find(".online_guests").html(guest.length - offline.length); //更新在线人数
	guest_div.find(".total_guests").html(guest.length); //更新总数
}

//客人增加信息数
function guest_update(gid){
	var o = g_online.find("#gst_" + gid + ">>b");
	var x = parseInt(o.html()) + 1;

	if(x > 99){
		x = "99..";
	}else{
		x = "+" + x;
	}

	o.html(x).show();
}

//删除客人并清除信息
function guest_delete(gid){
	gid = parseInt(gid);

	$('#win_'+gid).remove(); //清除窗口
	g_online.children('#gst_' + gid).remove(); //更新列表

	guest.splice($.inArray(gid, guest), 1); //删除数组中的元素	
	offline.splice($.inArray(gid, offline), 1); //删除离线数组中的元素

	guest_num_update(); //更新访客人数统计显示
}

//客人窗口输出信息, no_format是否不格式化输出的信息
function guest_output(d, gid, type, no_format){
	if(!d || !gid || !type) return; //没有信息及类型返回
	TitleSound(1);

	var o = $("#win_" + gid).find(".g_history");

	if(type != 1) o.find(".overview>div.updating").remove(); //删除输入状态

	d = format_output(d);

	switch(type){
		case 1: //客服
			d = '<div class="msg r"><b></b><div class="b"><div class="i">' + d + '</div></div><i>' + getLocalTime() + '</i></div>';
			break;
		case 2: //客人
			if(CurrentId == gid) CurrentUnread = 1; //标记当前窗口用户有未读消息

			d = '<div class="msg l"><b></b><div class="b"><div class="i">' + d + '</div></div><i>' + getLocalTime() + '</i></div>';
			break;
		case 3: //正常提示
			d = '<div class="msg s"><div class="b"><div class="ico"></div><div class="i">' + d + '</div></div></div>';
			break;
		case 4: //错误提示
			d = '<div class="msg e"><div class="b"><div class="ico"></div><div class="i">' + d + '</div></div></div>';
			break;
	}

	o.find(".overview").append(d);
	o.welivebar_update('bottom'); //滚动到底部

	if(!CurrentId || !welive.where){
		openWin(gid); //如果没有打开小窗口, 或者welive位置在群聊区, 自动弹出
	}else{
		if(CurrentId != gid) guest_update(gid); //其它情况, 增加未读消息数量
	}

	//当前客人未离线移动到顶部
	if($.inArray(gid, offline) < 0) guest_movetop(gid);
}

//客服交流输出信息
function welive_output(d, gid, type){
	if(gid){
		guest_output(d, gid, type);
	}else{
		if(d === false) return; //没有信息返回
		TitleSound();

		s_history.append(d);
		s_hwrap.welivebar_update('bottom'); //滚动到底部

		s_chat_update(); //收拢时更新未读数量
	}
}

//客服连接验证
function welive_verify(){
	welive.status = 1;
	welive_send({type: "login", from: "backend", session_id: admin.sid, agent: admin.agent, admin_id: admin.id, mobile: 0});

	//将挂起及解除挂起按钮恢复
	$(".set_serving").hide();
	$(".set_busy").show();
}

//连接断开时执行
function welive_close(){
	if(welive.status){ //之前已连接时
		s_online.html(""); //清空客服在线列表
		s_admins.html(0); //将客服在线人数清0
	}

	welive.status = 0;
	clearInterval(ttt_1); //连接断开后停止发送心跳数据

	//允许重新连接
	if(welive.autolink){
		welive_output('<div class="i"><b></b>连接失败, 3秒后自动重试 ...</div>');
		welive.ttt = setTimeout(welive_link, 3000);
	}
}


//发送信息(直接)
function welive_send(d){
	var re = 0;

	if(welive.status) {
		welive.ws.send(JSON.stringify(d)); //将json对象转换成字符串发送
		re = 1;
	}else if(welive.autolink){
		welive_output('<div class=i><b></b>服务器连接中, 请等待 ...</div>');
	}

	return re; //回返是否成功
}


//给客人发信息
function guest_send(){
	//if(!CurrentId || $.inArray(CurrentId, offline) > -1) return; //客人离线无法发送信息
	if(!CurrentId) return; //客人离线仍可发信息

	var o = $('#win_' + CurrentId).find('.g_msg');
	var msg = $.trim(o.val());

	if(msg){
		msg = {type: "msg", sendto: "front", guestid: CurrentId, msg: msg};
		if(welive_send(msg)) o.val(''); //发送成功时清空输入框
	}

	search_result_hide(); //关闭搜索结果

	o.focus();
}


//点击上传图片或文件给客人
function do_upload(){
	if($.inArray(CurrentId, offline) > -1) return;  //客人不在线时

	guest_output('免费版无上传功能!', CurrentId, 4);
	$('#win_' + CurrentId).find('.g_msg').focus();
	return false;
}

//踢出客人
function guest_kickout(){
	if($.inArray(CurrentId, offline) < 0){
		welive_send({type: "s_handle", operate: "kickout", guestid: CurrentId}); //客人在线, 发送踢出请求
	}

	guest_delete(CurrentId);
	CurrentId = 0;
	$("#tiptip_holder").hide();
	showNext();
}

//禁止发言
function guest_banned(){
	if($.inArray(CurrentId, offline) > -1) return;

	welive_send({type: "s_handle", operate: "banned", guestid: CurrentId, ban: 1}); //禁止发言
	guest_output('此客人已被禁言, 但你仍然可以对其发言!', CurrentId, 4);

	$("#tiptip_holder").hide();

	var curr_win = $("#win_" + CurrentId);

	curr_win.find(".t_banned").hide();
	curr_win.find(".t_unban").show();

	curr_win.find('.g_msg').focus();
}

//解除禁言
function guest_unban(me){
	if($.inArray(CurrentId, offline) > -1) return;

	welive_send({type: "s_handle", operate: "banned", guestid: CurrentId, ban: 0}); //解除禁言

	guest_output('此客人禁言状态已解除.', CurrentId, 3);
	$(me).parent().children(".t_banned").show();
	$(me).hide();

	$('#win_' + CurrentId).find('.g_msg').focus();
}

//授权上传图片文件
function guest_authupload(){
	guest_output('免费版无授权功能!', CurrentId, 4);
	$('#win_' + CurrentId).find('.g_msg').focus();
}


//获得在线客服列表, tipTip中使用
function get_supporters(){
	if($.inArray(CurrentId, offline) > -1){
		$('.s_transfer').html('此客人已离线, 无法转接!');
		return;
	}

	var num = 0;

	$('.s_transfer').html(s_online.html()).children('li').each(function() {
		var aix = $(this).attr('id');

		if(admin.aix == aix || aix == "robot818"){
			$(this).remove(); //去掉自己或机器人
			return;
		}

		num += 1;
			
		$(this).click(function(){
			if($.inArray(CurrentId, offline) > -1){
				guest_output('此客人已离线, 无法转接!', CurrentId, 4);
				return;
			}
			welive_send({type: "s_handle", operate: "trans_guest", guestid: CurrentId, aix: aix}); //发送转接请求

			$("#tiptip_holder").hide();
		});
	});

	if(!num) $('.s_transfer').html('暂无其它客服可转接!');
}

//获取当前客人数据
function get_guestprofile(me){
	var btn = $(me);
	var g_note = $('#win_' + CurrentId).find('.g_note');

	if(g_note.is(":hidden")){
		var loaded = g_note.attr("loaded");
		if(loaded != 1) welive_send({type: "s_handle", operate: "get_guest", guestid: CurrentId}); //发送客人数据请求

		g_note.show();
		btn.addClass("hover");
	 }else{
		g_note.hide();
		btn.removeClass("hover");
	 }
}

//关闭客人数据层
function close_profile(){
	$('#win_' + CurrentId).find('.g_note').hide();
	$('#win_' + CurrentId).find('.t_note').removeClass("hover");
	return false;
}

//保存当前客人数据
function guest_save(me){
	var arr = $(me).closest("form").serializeArray();

	var obj = {};
	
	//将数据转换成对象
	$.each(arr, function(index, field){
		obj[field.name] = field.value;
	});

	welive_send({type: "s_handle", operate: "save_guest", guestid: CurrentId, msg: obj});
}


//客人输入状态更新
function welive_runtime(gid, msg){
	if(!gid || !msg) return;

	msg = format_output(msg) + ' <img src="' + SYSDIR + 'public/img/writting.gif">';

	var o = $("#win_" + gid).find(".g_history");
	var updating = o.find(".overview>div.updating");

	if(updating.length){
		updating.find(".i").html(msg); //之前存在

	}else{
		msg = '<div class="msg updating"><b></b><div class="b"><div class="i">' + msg + '</div></div></div>';
		o.find(".overview").append(msg);
	}

	o.welivebar_update('bottom'); //滚动到底部
}


//获取常用短语搜索结果
function get_phrase(id, lang){
	if(lang == 1){
		var content = $(".phrases_div").html().replace(/towhere/ig, id);
	}else{
		var content = $(".phrasesen_div").html().replace(/towhere/ig, id);
	}

	$("#tiptip_content").html(content);
}


//关闭常用短语搜索结果
function search_result_hide(){
	if(phrase_search){
		phrase_search.hide();
		phrase_search = null;
	}
}

//搜索常用短语, 输入框停留1秒开始搜索
function search_phrases(me){
	clearTimeout(ttt_8);
	search_result_hide();

	if(all_phrases.length < 16) return; //少于8*2条不搜索(中英)

	var keyword = $.trim($(me).val());

	if(keyword.length < 2 || keyword.length > 16) return; //太长或太短均不搜索

	ttt_8 = setTimeout(function(){
		var result = "", tmp = "", keywords = keyword.split(/\s+/);

		all_phrases.each(function(){
			var ok = 1;
			tmp = $(this).html();

			$.each(keywords, function(i, key){
				if(tmp.indexOf(key) < 0){
					ok = 0;
					return false;
				}
			});

			if(ok) result += '<li onclick="insertPhrase(this, ' + CurrentId + ');"><i>●</i><b>' + tmp + '</b></li>';
		});

		if(result){
			phrase_search = $('#win_' + CurrentId).find('.g_search');
			phrase_search.html('<div class="g_search_title" onclick="search_result_hide();">常用短语 搜索结果：<b>X</b></div>' + result).show();
		}

	}, 1000); //延迟1秒搜索
}

//设置访客信息提示音
function set_sound(num, me){
	welive.sound1 = '<audio src="' + SYSDIR + 'public/mp3/kefu-' + num + '.mp3" autoplay="autoplay"></audio>';
	sounder.html(welive.sound1);
	sound_num = num;
	$(me).parent().children("i").removeClass("curr");
	$(me).addClass("curr");
	setCookie(COOKIE_KEFU, num, 1000);
}

//设置访客交互窗口模式
function set_win_mode(me){
	if(guest_win_mode == "multi"){
		guest_win_mode = "single";
		setCookie(COOKIE_KEFU + "_win", "single", 1000);
		$(me).attr('title', '切换到访客多窗口模式').html("单窗口");
	}else{
		guest_win_mode = "multi";
		setCookie(COOKIE_KEFU + "_win", "multi", 1000);
		$(me).attr('title', '切换到访客单窗口模式').html("多窗口");
	}
}


//welive初始化
function welive_init(){
	guest = new Array();
	offline = new Array(); //已离线的客人数组
	g_online = $("#g88");
	guest_div = $(".guest_div");

	s_chat = $("#s_chat");
	s_chat_num = $("#s_chat_num");
	s_msg = s_chat.find(".s_msg");
	s_send = s_chat.find(".s_send");
	s_admins = s_chat.find(".s_admins");
	s_title = s_chat.find(".s_title").children(".l");
	s_hwrap = s_chat.find("#s_hwrap");
	s_owrap = s_chat.find("#s_owrap");
	s_history = s_hwrap.find(".overview");
	s_online = s_owrap.find(".overview");
	sounder = $("#wl_sounder");
	all_phrases = $(".phrases_wrap li b");

	welive_link(); //socket连接
	myWin88 = new WeLiveWin();

	var s_historyViewport = s_hwrap.find(".viewport"),
	s_onlineViewport = s_owrap.find(".viewport"),
	xHeight = $(window).height() - 88;

	guest_div.height(xHeight); //访客列表调整高度

	s_chat.height(xHeight);
	s_historyViewport.height(xHeight - 78);
	s_onlineViewport.height(xHeight - 74);

	s_hwrap.welivebar();
	s_owrap.welivebar();

	$(window).resize(function(){//窗口大小改变时
		var wh= $(window).height()-88;
		guest_div.height(wh);
		s_chat.height(wh);
		s_historyViewport.height(wh - 78);
		s_onlineViewport.height(wh - 74);
		s_hwrap.welivebar_update('bottom');
		s_owrap.welivebar_update();
	});

	s_msg.keyup(function(e){
		if(e.keyCode ==13) s_send.trigger("click");
	}).focus(function(){
		s_title.removeClass("off"); //群聊区选中
		welive.where = 0;
		if(CurrentId){
			$('#win_' + CurrentId).find('.x-user').removeClass("x-now");
		}
		g_online.children("div.curr").removeClass("curr");
	});

	//客服群聊发送信息
	s_send.click(function(e) {
		var msg = $.trim(s_msg.val());

		if(msg){
			msg = {type: "msg", sendto: "team", msg: msg};
			if(welive_send(msg)) s_msg.val('');
		}

		s_msg.focus();
		e.preventDefault();
	});

	//声音
	var wl_ring_btn = $("#wl_ring");
	wl_ring_btn.click(function(e) {
		if(welive.sound){
			welive.sound = 0;
			$(this).addClass("s_ringoff").removeClass("s_ring").attr("title", "声音关");
		}else{
			welive.sound = 1;
			$(this).addClass("s_ring").removeClass("s_ringoff").attr("title", "声音开");
		}
		s_msg.focus();
		e.preventDefault();
	});

	//表情符号
	s_chat.find(".s_face").tipTip({content: $(".smilies_div").html(), keepAlive:true, maxWidth:"242px", defaultPosition:"top", edgeOffset:-31, delay:300});

	//无人值守, 挂起, 解除挂起, 重启服务等提示
	$(".set_busy").tipTip({content: '1. 挂起后, 将不再接受新客人加入, 但其他客<br>&nbsp;&nbsp;&nbsp;&nbsp;服转接过来的客人仍会进入.<br>2. 一般地, 当自己特别忙时可使用挂起功能,<br>&nbsp;&nbsp;&nbsp;&nbsp;如果离开座席较长时间, 建议退出客服.<br>3. 如果所有在线的客服都挂起了, 挂起功能将<br>&nbsp;&nbsp;&nbsp;&nbsp;失效.', keepAlive:true, maxWidth:"300px", delay:600});

	var sysinfo = $(".sysinfo>a");

	sysinfo.tipTip({content: '1. 按 Ctrl + Alt: 在客服交流区与当前客人小窗口间切换.<br>2. 按 Ctrl + 下箭头 或 Esc键: 关闭当前客人小窗口.<br>3. 按 Ctrl + 上箭头: 展开关闭的客人小窗口.<br>4. 按 Ctrl + 左或右箭头: 在已展开的客人小窗口间切换.<br>5. 客人被踢出或禁言后, 其刷新页面仍可重新进入客服.<br>6. 客人获取上传授权后将会一直保留, 直至被客服解除.<br>7. 组长管理员发送all, admin, guest, robot查询运行数据.', keepAlive:true, maxWidth:"400px", defaultPosition:"top", delay:400});

	//显示操作提醒
	setTimeout(function(){
		sysinfo.trigger("mouseover");
		setTimeout(function(){sysinfo.trigger("mouseout");}, 5000); //5秒后关闭提醒
	}, 1000);


	//管理员或组长专有
	if(admin.type != 0){
		$(".set_robot_on").tipTip({content: '1. 每个客服组的无人值守状态均为独立设置, 互不影响.<br>2. 无人值守开启后, 所有本组客服均可离线.<br>3. 无人值守开启后, 新上线的访客将由机器人自动回复, 已经<br>&nbsp;&nbsp;&nbsp;&nbsp;在线的访客仍由原客服提供服务.<br>4. 无人值守开启后, 已登录的客服可接受来自机器人转接人工<br>&nbsp;&nbsp;&nbsp;&nbsp;客服而来的客人.<br>5. 无人值守开启后, 访客留言功能将失效.<br>6. Socket服务重启后, 无人值守状态需要重新设置.', keepAlive:true, delay:600});
	}

	$(".set_serving").tipTip();
	$(".set_robot_off").tipTip();

	//关闭声音, 停止闪烁, 快捷键等
	pagetitle = document.title;
	$(document).mousedown(stopFlashTitle).keydown(function(e){
		stopFlashTitle();
		if(e.which == 27 || (e.ctrlKey && e.which == 40)) { //Esc 或 ctrl + 下箭头
			closeWin(CurrentId);
		}else	if(e.ctrlKey && (e.which == 37 || e.which == 39)) { //ctrl + 左右箭头
			showNext();
		}else	if(e.ctrlKey && e.which == 38) { //ctrl + 上箭头
			showNext(1);
		}else	if(e.ctrlKey && e.which == 18) { //ctrl + alt
			if(CurrentId){
				if(welive.where == 1){
					s_msg.focus();
				}else{
					openWin(CurrentId);
				}
			
			}else{
				s_msg.focus(); //如果没有打开小窗口, 群聊输入框直接获得焦点
			}
		}
	});

	window.onbeforeunload=function(event){if(welive.status){return " ";}}; //离开当前页面时提示和选择
	$(window).unload(function(){welive.status=0;clearTimeout(welive.ttt);clearInterval(ttt_1);}); //关闭自动重连

	//每20分钟清除过长的客服间对话记录
	setInterval(welive_clear, 1000*1200);

	//客服群聊收拢展开
	s_chat.children(".s_title").click(function(e){
		s_chat_isopen = 0;
		s_chat_num.children("b").html(0); //收拢时未读数量清0
		s_chat.hide(200, function(){
			s_chat_num.show();
		});
	});

	s_chat_num.click(function(e){
		s_chat_isopen = 1;
		$(this).hide();
		s_chat.show(200);
	});

	//访客信息声音选择
	var mp3_div = $(".mp3_div");
	wl_ring_btn.tipTip({content: mp3_div.html(), enter: function(){$("#tiptip_content").find("i").eq(sound_num -1).addClass("curr");}, keepAlive:true, maxWidth:"350px", defaultPosition:"top", left: 10, arrowLeft: 155, edgeOffset:-4, delay:400, parent: true});
	mp3_div.html(""); //清除
}

//websocket
var WebSocket = window.WebSocket || window.MozWebSocket;

//定义全局变量
var tttt = 0, ttt_1 = 0, pagetitle, flashtitle_step = 0, sounder, towhere = 0, ttt_8 = 0, phrase_search = null, all_phrases = "", sound_num, guest_win_mode;
var guest, guest_div, offline, g_online, s_chat, s_msg, s_history, s_online, s_send, s_hwrap, s_owrap, s_admins, s_title, s_chat_num, s_chat_isopen = 1;
var welive = {ws:{}, index: 0, status: 0, autolink: 1, ttt: 0, flashTitle: 0, sound: 1, sound1: '', sound2: '', where: 0, is_robot: 0};

var myWin88, CurrentId = 0, CurrentUnread = 0, zIndex = 2000;

var file_chunk_size = 1048576; //切片大小 默认为1M
var file_temp_data = ""; //切片上传文件时使用

var x_win_content = '<div class="g_history"><div class="scb_scrollbar scb_radius"><div class="scb_tracker"><div class="scb_mover scb_radius"></div></div></div><div class="viewport"><div class="overview">888888</div></div></div><div class="g_tools"><a class="t_smilies" title="表情符号"></a><a class="t_phrase" title="常用短语"></a><a class="t_photo" title="发送图片或文件" onclick="do_upload();return false;"></a><a class="t_transfer" title="转接客人"></a><a class="t_note" title="记录客人信息" onclick="get_guestprofile(this);return false;"></a><a class="t_unban" title="解除禁言" onclick="guest_unban(this);return false;"></a><a class="t_banned" title="禁止发言"></a><a class="t_kickout" title="踢出客人"></a><a class="t_authupload" title="授权上传图片或文件"></a><a class="t_offupload" title="解除上传授权"></a></div><div class="g_bott"><textarea name="g_msg" class="g_msg scroll"></textarea><a class="g_send" title="发送" onclick="guest_send();return false;"></a></div><div class="phrases_wrap g_search"></div><div class="g_note" loaded="0"><form onsubmit="return false;"><li class="f"><b>来源:</b><u><a href="" target="_blank" class="fromurl"></a></u></li><li class="f"><b>地区:</b><u class="ipzone"></u></li><li class="f"><b>意向:</b><input type="radio" value="1" name="grade"><i>1分</i><input type="radio" value="2" name="grade"><i>2分</i><input type="radio" value="3" name="grade"><i>3分</i><input type="radio" value="4" name="grade"><i>4分</i><input type="radio" value="5" name="grade"><i>5分</i></li><li><b>姓名:</b><input name="fullname" type="text" class="s"></li><li><b>电话:</b><input name="phone" type="text" class="l"></li><li><b>Email:</b><input name="email" type="text" class="l"></li><li><b>地址:</b><input name="address" type="text" class="l"></li><li><b>备注:</b><textarea name="remark"></textarea></li><li class="bt"><input class="cancel" type="submit" value="保存更新" onclick="guest_save(this);return false;">&nbsp;&nbsp;&nbsp;&nbsp;<input class="cancel" type="submit" value="取消" onclick="return close_profile();"></li></form></div>';


$(function(){

	if(WS_HOST == "")	WS_HOST = document.domain; //先记录下来供websocket连接使用

	//访客信息提示音
	sound_num = getCookie(COOKIE_KEFU);
	if(!sound_num) sound_num = "1";
	welive.sound1 = '<audio src="' + SYSDIR + 'public/mp3/kefu-' + sound_num + '.mp3" autoplay="autoplay"></audio>';

	//初始化访客窗口模式
	guest_win_mode = getCookie(COOKIE_KEFU + "_win");
	if(!guest_win_mode) guest_win_mode = "multi";

	if(guest_win_mode == "single"){
		$(".guest_win_mode").attr('title', '切换到访客多窗口模式').html("单窗口");
	}

	//客服群聊信息提示音
	welive.sound2 = '<audio src="' + SYSDIR + 'public/sound2.mp3" autoplay="autoplay"></audio>';

	welive_init(); //welive初始化

	$("#topbar dl").Jdropdown({delay: 50}, function(a){});

	//退出登录
	$(".logout").click(function(e) {
		showDialog('确定退出 WeLive 在线客服系统吗?', '', function(){
			document.location = 'index.php?a=logout';
		});

		e.preventDefault();
	});
});
<?php  

define('ROOT', dirname(__FILE__).'/');  //系统程序根路径, 必须定义, 用于防翻墙
require(ROOT . 'includes/core.guest.php');  //加载核心文件

if(!$_CFG['Actived']) shut_down($langs['shutdown']);

//正式开始
$a = intval($_GET['a']);
if($a !== 621276866) die('Access denied.'); //简单地防止直接访问当前文件(并不重要)


//原网站用户id ---用户接口
$id = intval($_GET['id']);

//原网站用户名或昵称fullname ---用户接口
$fn = str_replace(array('"', "'"), "", trim($_GET['fn'])); //去掉引号, 避免JS运行出错


$gid = intval($_GET['gid']); //访客ID, 解决跨域问题
$group = intval($_GET['group']); //客服组
if(!$group) $group = 1;

//客服组问候语
if(IS_CHINESE){
	if(isset($team_welcomes[$group]) AND $team_welcomes[$group]['welcome']){
		$team_welcome = $team_welcomes[$group]['welcome'];
	}else{
		$team_welcome = $_CFG['Welcome'];
	}
}else{
	if(isset($team_welcomes[$group]) AND $team_welcomes[$group]['welcome_en']){
		$team_welcome = $team_welcomes[$group]['welcome_en'];
	}else{
		$team_welcome = $_CFG['Welcome_en'];
	}
}

$fromurl = base64_decode(trim($_GET['url']));
$fromurl = explode("#", $fromurl); //去掉URL中#号起的内容
$fromurl = $fromurl[0];

$json = new JSON; //将语言转换成js对象

$smilies = ''; //表情图标
for($i = 0; $i < 24; $i++){
	$smilies .= '<img src="' . SYSDIR . 'public/smilies/' . $i . '.png" onclick="insertSmilie(' . $i . ');">';
}

$agent = get_userAgent($_SERVER['HTTP_USER_AGENT']);

$key = PassGen(8);
$code = authcode(md5(WEBSITE_KEY . $_CFG['KillRobotCode']), 'ENCODE', $key, 3600*8); //8小时过期(8小时后断线重连将失败)

header_nocache(); //不缓存
header('P3P: CP=CAO PSA OUR'); //解决IE下iframe cookie问题

//不活动自动离线时间
$auto_offline  = intval($_CFG['AutoOffline']); //自动离线时间(分)
$auto_offline  = Iif($auto_offline, $auto_offline, 8) * 60000; //自动离线时间(毫秒)

//输入状态更新时间
$update_time  = intval($_CFG['Update']); //状态更新时间(秒)
$update_time  = Iif($update_time, $update_time, 2) * 1017; //状态更新时间(毫秒), 设置一个怪异的数字避免与自动离线的时间间隔重合, 避免在同一时间点上send数据上可能产生 -----幽灵bug

//客服组常见问题
$questions_str = "";
foreach($team_questions AS $k => $q){
	if($q['grid'] == $group){
		$questions_str .= '<li>' . $q['title'] . '</li>';
	}
}

echo '<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<title>' . $_CFG['Title'] . '</title>
<link rel="shortcut icon" href="' . SYSDIR . 'public/img/favicon.ico" type="image/x-icon">
<link rel="stylesheet" href="public/guest-new.css?v=' . APP_VERSION . '">
<script type="text/javascript" src="public/jquery.126.js"></script>
<script type="text/javascript">
SYSDIR = "' . SYSDIR . '",
COOKIE_USER = "' . COOKIE_USER . '",
SYSKEY = "' . $key . '",
SYSCODE = "' . $code . '",
WS_HEAD = "' . WS_HEAD . '",
WS_HOST = "' . WS_HOST . '",
WS_PORT = "' . WS_PORT . '",
update_time = ' . $update_time . ',
offline_time = ' . $auto_offline . ',
auth_upload = ' . $_CFG['AuthUpload'] . ',
upload_filesize = ' . $_CFG['UploadLimit'] . ',
guest = {group: ' . $group . ', gid: ' . $gid . ', oid: ' . $id . ', fn: "' . $fn . '", aid: 0, au: 0, an: "", sess: "", lang: ' . IS_CHINESE . ', agent: "' . $agent . '", fromurl: "' . $fromurl . '"},
welcome = "' . $team_welcome . '",
comment_note = "' . Iif(IS_CHINESE, $_CFG['Comment_note'], $_CFG['Comment_note_en']) . '",
langs = ' . $json->encode($langs) . ';
</script>
</head>
<body>
<div class="main">
	<div class="top_div">
		<div class="top_left">
			<div id="welive_operator">
				<div class="operator_left">
					<img src="' . SYSDIR . 'public/img/welive.png" id="welive_avatar" style="padding:2px;">
					<div id="welive_name">' . $langs['welive'] . '</div>
					<div id="welive_duty">Connecting ...</div>
				</div>
				<div class="operator_mid">' . $_CFG['Title'] . '</div>
				<div id="welive_copyright" class=""><a href="javascript:;" target="_blank" onclick="return false;">&copy; WeLive</a></div>
			</div>
			<div class="history">
				<div class="scb_scrollbar scb_radius"><div class="scb_tracker"><div class="scb_mover scb_radius"></div></div></div>
				<div class="viewport loading3">
					<div class="overview scroll">
						<div class="msg s">
							<div class="b">
								<div class="i">' . $langs['connecting'] . '</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="enter">
				<div class="tool_bar">
					<div id="toolbar_emotion" title="' . $langs['emotions'] . '" class="tool_bar_i"></div>
					<div id="toolbar_photo" title="' . $langs['sendphoto'] . '" class="tool_bar_i"></div>
					<div id="toolbar_file" title="' . $langs['sendfile'] . '" class="tool_bar_i"></div>
					<div id="toolbar_sound" title="' . $langs['sound'] . '" class="tool_bar_i"></div>
					<div id="toolbar_evaluate" title="' . $langs['evaluate'] . '" class="tool_bar_i"></div>
					<div class="tool_bar_call">
						<input type="text" id="phone_num" maxlength="26" placeholder="' . $langs['type_phone'] . '" class="welive_border_1">
						<div id="phone_call_back" class="tool_bar_phone welive_color_1" title="' . $langs['require_callback'] . '"><s class="tool_bar_i"></s></div>
					</div>
				</div>
				<div id="alert_info"></div>
				<textarea name="msger" placeholder="' . $langs['type_question'] . '" class="msger scroll"></textarea>
				<input type="file" name="file" id="upload_img" accept="image/jpg,image/jpeg,image/gif,image/png" style="width:1px;height:1px;display:none;overflow:hidden;">
				<a id="trans_to_btn" onclick="trans_to_support();return false;" class="trans_to" style="display:none">' . $langs['trans_to'] . '</a>
				<a id="sender_msg" class="sender welive_color_1">' . $langs['send'] . '</a>
			</div>
			<div class="q_search"></div>
			<div id="wl_sounder" style="width:1px;height:1px;visibility:hidden;overflow:hidden;"></div>
			<div class="smilies_div" style="display:none"><div class="smilies_wrap">' . $smilies . '</div></div>
			<div id="starRating" style="display:none">
				<p class="title">' . $langs['rating_title'] . '</p>
				<p class="star">
					<span star_val="1"><i class="high"></i><i class="nohigh"></i></span>
					<span star_val="2"><i class="high"></i><i class="nohigh"></i></span>
					<span star_val="3"><i class="high"></i><i class="nohigh"></i></span>
					<span star_val="4"><i class="high"></i><i class="nohigh"></i></span>
					<span star_val="5" class="last"><i class="high"></i><i class="nohigh"></i></span>
				</p>
				<p class="starInfo">' . $langs['select_star'] . '</p>
				<p><textarea placeholder="' . $langs['rating_advise'] . '" id="rating_advise" class="scroll"></textarea></p>
				<p><a id="sender_eval" class="sender welive_color_1" onclick="send_evaluate();return false;">' . $langs['submit'] . '</a></p>
			</div>
		</div>

		<div class="top_right">
			<div class="right_title">
			自定义内容标题
			</div>
			<div class="right_content scroll">
			在这里添加自定义内容<br><br><font color=red>注：</font>编辑WeLive根目录下的<br>welive-new.php文件，可修改自定义标题及内容
			</div>
		</div>

	</div>
	<div class="bottom_div">Copyright ' . date("Y") . ' All Right Reserved ' . $_CFG['Title'] . ' 版权所有</div>
</div>
<div id="welive_big_img" class="welive_popup"><div class="big_img_wrap"></div></div>
<div id="questions_div" style="display:none">' . $questions_str . '</div>
<script type="text/javascript" src="public/guest-new.js?v=' . APP_VERSION . '"></script>
</body>
</html>';


function shut_down($info){
	echo '<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
</head>
<body style="background-color:#fff;margin:0;padding:0;">
	<div style="font-size:18px;color:red;text-align:center;margin:0;padding:0;padding-top:300px;">
	' . $info . '
	</div>
</body>
</html>';

	die();
}


?>
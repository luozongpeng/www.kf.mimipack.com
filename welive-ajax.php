<?php  

define('ROOT', dirname(__FILE__).'/');  //系统程序根路径, 必须定义, 用于防翻墙

require(ROOT . 'includes/core.guest.php');  //加载核心文件
require(ROOT . 'includes/functions.ajax.php');  //加载需要的函数

if(!$_CFG['Actived']) die("Access denied");

//ajax操作
$ajax =  ForceIntFrom('ajax');
if(!$ajax) die("Access denied");


if($dbmysql == "mysqli"){
	$DB = new DBMysqli($dbusername, $dbpassword, $dbname,  $servername, false, false); //MSQLI, 不显示mysql查询错误
}else{
	$DB = new DBMysql($dbusername, $dbpassword, $dbname,  $servername, false, false);
}

$dbpassword = '';

$act = ForceStringFrom('act');

//访客留言
if($act == "comment"){
	$key = ForceStringFrom('key');
	$code = ForceStringFrom('code');
	$decode = authcode($code, 'DECODE', $key);
	if($decode != md5(WEBSITE_KEY . $_CFG['KillRobotCode'])){
		ajax_msg(); //验证码过期
	}

	$fullname = ForceStringFrom('fullname');
	$email = ForceStringFrom('email');
	$phone = ForceStringFrom('phone');
	$content = ForceStringFrom('content');
	$vid = ForceIntFrom('vid');
	$vvc = ForceIntFrom('vvc');

	if(!$fullname OR strlen($fullname) > 90){
		ajax_msg(2);
	//}elseif(!IsEmail($email)){ //不再检查
		//ajax_msg(3);
	}elseif(!$content OR strlen($content) > 1800){
		ajax_msg(4);
	}elseif(!checkVVC($vid, $vvc)){
		ajax_msg(5);
	}

	$grid = ForceIntFrom('grid', 1); //如果没有, 设置为默认客服组
	$gid = ForceIntFrom('gid');
	$ip = GetIP();

	if(preg_match("/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/", $ip)){
		$is_banned = $DB->getOne("SELECT fid FROM " . TABLE_PREFIX . "firewall WHERE ip = '$ip' AND expire > " . time());
		if($is_banned){
			$DB->exe("UPDATE " . TABLE_PREFIX . "firewall SET bans = (bans + 1) WHERE fid = " . $is_banned['fid']); //记录次数
			ajax_msg(); //伪装成验证码过期
		}
	}

	$DB->exe("INSERT INTO " . TABLE_PREFIX . "comment (grid, gid, fullname, ip, phone, email, content, time) VALUES ('$grid', '$gid', '$fullname', '$ip', '$phone', '$email', '$content', '".time()."')");
	ajax_msg(1);
}

//生成验证码, 返回vvc id
elseif($act == 'vvc'){
	$key = ForceStringFrom('key');
	$code = ForceStringFrom('code');
	$decode = authcode($code, 'DECODE', $key);

	if($decode != md5(WEBSITE_KEY . $_CFG['KillRobotCode'])){
		ajax_msg();
	}

	$status = createVVC();
	ajax_msg($status);
}

//获取验证码图片
elseif($act == 'get'){
	getVVC();
	die();
}


//ajax输出函数
function ajax_msg($status = 0, $msg = '', $arr = array()){
	$arr['s'] = $status;
	$arr['i'] = $msg;

	$json = new JSON;

	die($json->encode($arr));
}


?>
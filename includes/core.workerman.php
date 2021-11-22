<?php if(!defined('ROOT')) die('Access denied.');

// 屏蔽错误代码
error_reporting(0);
//error_reporting(E_ALL & ~E_NOTICE);


@include(ROOT . 'config/config.php');
require(ROOT . 'config/settings.php');
require(ROOT . 'includes/functions.workerman.php');

// 设置超时时间
@set_time_limit(0);
@ignore_user_abort(true); //忽略用户断开连接, 服务器脚本仍运行

// 设置当前脚本可使用的最大内存
@ini_set('memory_limit', '2048M'); //2G

Events::$_CFG = $_CFG; //设置Events静态成员$_CFG引用全局的系统配置数组$_CFG

//引入数据库类
if($dbmysql == "mysqli"){
	include(ROOT . 'includes/class.DBMysqli.php');
	Events::$DB = new DBMysqli($dbusername, $dbpassword, $dbname,  $servername, false, false); //mysqli 不输出错误(不使用die输出)
}else{
	include(ROOT . 'includes/class.DBMysql.php');
	Events::$DB = new DBMysql($dbusername, $dbpassword, $dbname,  $servername, false, false); //mysql
}

//设置mysql数据库wait_timeout, 否则当此socket进程长驻, 而mysql空闲8小时(默认), 此进程将无法连接数据库, 导致客服无法登录
Events::$DB->query("SET session wait_timeout=31536000"); //一年

$dbpassword = '';

?>
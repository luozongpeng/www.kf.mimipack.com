<?php

/**
 * 用于检测业务代码死循环或者长时间阻塞等问题
 * 如果发现业务卡死，可以将下面declare打开（去掉//注释），并执行php start.php reload
 * 然后观察一段时间workerman.log看是否有process_timeout异常
 */
//declare(ticks=1);

use \GatewayWorker\Lib\Gateway;
use \Workerman\Lib\Timer;


//系统程序根路径, 必须定义, 用于防翻墙、文件调用等
define('ROOT', dirname(dirname(dirname(__FILE__))).'/');

//加载核心文件
require(ROOT . 'includes/core.workerman.php');


/**
 * 主逻辑
 * 主要是处理 onConnect onMessage onClose 三个方法
 * onConnect 和 onClose 如果不需要可以不用实现并删除
 */
class Events
{
	/**
	 * 数据库访问对象
	 * @var object
	 */
	public static $DB;

	/**
	 * 系统设置数组
	 * @var array
	 */
	public static $_CFG;

	/**
	 * robot机器人数组
	 * @var array
	 */
	public static $robot;

	/**
	 * 客服组数组
	 * @var array
	 */
	public static $team = array();

    /**
     * 当客户端连接时触发
     * 如果业务不需此回调可以删除onConnect
     * 
     * @param string $client_id 连接id
     */
    public static function onConnect($client_id)
    {
        // 连接到来后，定时6秒关闭这个链接，需要6秒内发认证并删除定时器阻止关闭连接的执行
        $_SESSION['auth_timer_id'] = Timer::add(6, function($client_id){

            Gateway::closeClient($client_id);

        }, array($client_id), false);
	}
    
   /**
    * 当客户端发来消息时触发
    * @param string $client_id 连接id
    * @param string $data 具体消息
    */
   public static function onMessage($client_id, $data)
   {
		// 将json数据转换为对象
        $data = json_decode($data);

        switch($data->type)
        {
            case 'ping': //心跳
				
				break;

            case 'runtime': //访客发送的实时输入信息
				self::checkGuest();

				$msg = htmlspecialchars($data->msg); //处理html特殊字符, 无需mysql过滤

				//超过 2k 字节
				if(strlen($msg) > 2048) $msg = "... too long ..."; 

				if($msg){
					$dd = array('x' => 4, 'a' => 1, 'g' => $_SESSION['gid'], 'i' => $msg);
				}else{
					$dd = array('x' => 4, 'a' => 2, 'g' => $_SESSION['gid']);
				}

				self::sendToClient($_SESSION['aix'], $dd);
				
				break;

            case 'msg': //消息

				$msg = $data->msg;

				//超过 2k 字节
				if(strlen($msg) > 2048) $msg = "... too long ..."; 

				//客服群聊
				if($data->sendto == 'team'){

					self::supportChat($client_id, htmlspecialchars($msg)); //处理html特殊字符, 无需mysql过滤

				//客人发送给客服
				}elseif($data->sendto == "back"){

					$msg = forceString($msg);

					self::sayToSupport($client_id, $msg);

				//客服发送给客人
				}elseif($data->sendto == "front"){

					$gid = forceInt($data->guestid);
					$msg = forceString($msg);

					self::sayToGuest($client_id, $gid, $msg);
				}

				break;

			case 'login': //登录

				//客服登录验证
				if($data->from == 'backend'){

					self::adminLogin($client_id, $data);

				//访客登录验证
				}elseif($data->from == 'front'){

					self::guestLogin($client_id, $data);
				}

                break;

            case 's_handle': //客服操作

				self::supportHandle($client_id, $data);

				break;

            case 's_readed': //客服发送来的已读信号

				self::checkSupport();

				$gid = forceInt($data->gid);
				$guest = self::getSessionByGid($gid);

				if($guest) self::sendToClient($guest['client_id'], array('x' => 8));

				break;

            case 'g_handle': //访客操作(发起的)

				self::guestHandle($client_id, $data);

				break;

			default: //非法连接断开
				Gateway::closeClient($client_id);

				break;
        }

   }
   
   /**
    * 当用户断开连接时触发
    * @param string $client_id 连接id
    */
   public static function onClose($client_id)
   {
		$session = $_SESSION; //先将$_SESSION赋值保存, 否则异步操作$_SESSION可能丢失

		// 未检测到心跳数据或连接断开时
		if(isset($session['type'])){ //客服离线时, type为客服专用的session数组key

			$aid = $session['aid'];

			//给组内其他客服发送离线信息
			$dd = array('x' => 2, 'a' => 2, 'aid' => $aid, 'ix' => $client_id, 'i' => $session['fullname']);
			Gateway::sendToGroup($session['team_id'], json_encode($dd)); //worker组的客服组id, 避免重复, 客服前使用a_识别

			if(!$session['grid']) return; //客服是重复连接, 返回之

			//给所有属于自己的客人发送离线通知, 通知并禁止发言
			$dd = array('x' => 6, 'a' => 2);
			$team_guests = Gateway::getClientSessionsByGroup($session['grid']); //所有本组客人

			foreach($team_guests AS $idx => $guest){
				if($guest['aid'] == $session['aid'])  self::sendToClient($idx, $dd);
			}

			//设置离线状态			
			self::$DB->exe("UPDATE " . TABLE_PREFIX . "admin SET online = 0  WHERE aid = '$aid'");

		}elseif(isset($session['gid'])){ //客人离线

			//给当前客服发送离线通知
			//if(!isset($session['aix'])) return; //未分配客服时此值未设置, 返回
				
			$aix = $session['aix']; //当前客人的客服client_id或机器人的aix

			if($aix){

				$support = Gateway::getSession($aix);

				if(!$support) return; //客服不存在时, 返回

				if($support['guest_num'] > 0){
					Gateway::updateSession($aix, array('guest_num' => $support['guest_num'] - 1)); //客服的客人数减1
				}

				//当访客有grid时, 才给客服发离线信息(解决访客重复连接的问题)
				if($session['grid']){
					$dd = array('x' => 6, 'a' => 3, 'g' => $session['gid']); //给客服发送客人离线通知
					self::sendToClient($aix, $dd);

					//删除此客人的session
					self::$DB->exe("UPDATE " . TABLE_PREFIX . "guest SET session = '' WHERE gid = '" . $session['gid'] . "' ");
				}
				
			}
		}

   }


   /**
    * 给单个连接发送数据
    * @param string $client_id
    * @param array $data 客服的 work组id
    */
   private static function sendToClient($client_id, $data)
   {
		if(!$data) return false;

		Gateway::sendToClient($client_id, json_encode($data));
   }


   /**
    * 获取访客的SESSION
    * @param int $gid 访客id
    * 
    * @return array
    */
   private static function getSessionByGid($gid)
   {
		$gixs = Gateway::getClientIdByUid($gid); //客人的连接id, 数组
		$gix = $gixs[0]; //仅取第一个客人

		if(empty($gixs) OR !$gix) return array();

		return Gateway::getSession($gix);
   }



	/**
    * clearAdmin 清除重复连接的客服
    * @param string $work_id 客服的 work用户id
    */
   private static function clearAdmin($work_id)
   {
	   $admins = Gateway::getClientIdByUid($work_id); //返回连接id数组

	   foreach($admins AS $client_id){
			//先给此连接的客服发送一个废弃连接的通话
			self::sendToClient($client_id, array('x' => 2, 'a' => 7));

			Gateway::updateSession($client_id, array('grid' => 0)); //清除重复连接的客服的组id, 用于阻止给同一客服的客人发送离线信息

			Gateway::closeClient($client_id); //关闭连接
	   }
   }


   /**
    * adminLogin 客服登录
    * @param string $client_id 连接id
    * @param object $data 登录时请求的数据对象
    */
   private static function adminLogin($client_id, $data)
   {
		$admin_id = forceInt($data->admin_id);
		$mobile = forceInt($data->mobile); //0来自web, 1来自移动端

		$agent = $data->agent; //浏览器
		$session_id = $data->session_id;

		//过滤非法字符
		if(!$admin_id OR !isAlnum($session_id) OR !isAlnum($agent)){
			Gateway::closeClient($client_id); //用户不合法, 断开连接, 不通知
			return false;
		}

		$sql = "SELECT a.aid, a.type, a.grid, a.fullname, a.fullname_en, a.post, a.post_en, g.sort, g.activated, g.groupname, g.groupname_en
					FROM " . TABLE_PREFIX . "session s
					LEFT JOIN " . TABLE_PREFIX . "admin a ON a.aid = s.aid
					LEFT JOIN " . TABLE_PREFIX . "group g ON a.grid = g.id
					WHERE s.sid    = '$session_id'
					AND s.aid = '$admin_id'
					AND s.agent = '$agent'
					AND a.activated = 1
					AND g.activated = 1";

		$admin = self::$DB->getOne($sql);
		if(!$admin OR !$admin['aid']){
			Gateway::closeClient($client_id); //用户不合法, 断开连接, 不通知
			return false;
		}

		// 认证成功，删除 6秒关闭连接 的定时器
		Timer::del($_SESSION['auth_timer_id']);

		//登录成功后
		$group_id = $admin['grid']; //客服组id
		$avatar = GetAvatar($admin_id, 1); //获取客服头像, 返回文件名

		$work_id = "a_{$admin_id}"; //worker用户id, 区分客服和客人, 避免重复, 客服前使用a_识别
		$team_id = "a_{$group_id}"; //worker客服组id, 避免重复, 客服前使用a_识别

		//清除重复登录的客服
		$is_reconnected = 0;
		if(Gateway::isUidOnline($work_id)){
			$is_reconnected = 1;
			self::clearAdmin($work_id);
		}

		//更新在线状态
		self::$DB->exe("UPDATE " . TABLE_PREFIX . "admin SET online = 1  WHERE aid = '$admin_id'");

		//绑定work用户id不能重复, 客服前使用a_识别
		Gateway::bindUid($client_id, $work_id);

		//记录客服信息
		$_SESSION['client_id'] = $client_id; //客服的连接id
		$_SESSION['work_id'] = $work_id; //worker用户id
		$_SESSION['team_id'] = $team_id; //worker客服组id

		$_SESSION['aid'] = $admin_id;
		$_SESSION['type'] = $admin['type']; //客服类型: 1 管理员, 2组长, 0 客服
		$_SESSION['grid'] = $group_id; //客服组id

		$_SESSION['fullname'] = $admin['fullname']; //昵称
		$_SESSION['fullname_en'] = $admin['fullname_en'];
		$_SESSION['post'] = $admin['post']; //职位
		$_SESSION['post_en'] = $admin['post_en'];

		$_SESSION['busy'] = 0; //是否忙碌(挂起状态)
		$_SESSION['avatar'] = $avatar; //头像文件名
		$_SESSION['mobile'] = $mobile; //0来自web, 1来自移动端

		$_SESSION['guest_num'] = 0; //客人数

		//记录客服组信息, 且每次客服登录都会更新其信息
		self::$team[$team_id]['id'] = $group_id;
		self::$team[$team_id]['sort'] = $admin['sort'];
		self::$team[$team_id]['groupname'] = $admin['groupname'];
		self::$team[$team_id]['groupname_en'] = $admin['groupname_en'];

		//先通知本组已登录的其他客服
		$dd = array('x' => 2, 'a' => 1, 'ix' =>$client_id, 'id' => $admin_id, 't' => $admin['type'], 'n' => $admin['fullname'], 'p' => $admin['post'], 'av' => $avatar, 'fr' => $mobile);
		Gateway::sendToGroup($team_id, json_encode($dd));

		//加入客服组
		Gateway::joinGroup($client_id, $team_id);

		//获取属于自己的客人
		$guest_list = array();
		$admin_list = array();

		//将本组在线客服数据(包括自己), 及属于自己且在线的客人信息发送给自己
		$get_admins = Gateway::getClientSessionsByGroup($team_id);

		foreach($get_admins AS $ix => $session) {
			$admin_list[] = array('ix' =>$ix, 'id' => $session['aid'], 't' => $session['type'], 'n' => $session['fullname'], 'p' => $session['post'], 'av' => $session['avatar'], 'b' => $session['busy'], 'fr' => $session['mobile']);
		}

		//查找本组内属于自己的客人, 发送上线通知
		$team_guests = Gateway::getClientSessionsByGroup($_SESSION['grid']);

		foreach($team_guests AS $idx => $guest){
			if($guest['aid'] == $admin_id){

				//更新客人session中客服的连接索引
				Gateway::updateSession($guest['client_id'], array('aix' => $client_id));

				//重复连接不给客人发送通知
				if(!$is_reconnected) self::sendToClient($idx, array('x' => 6, 'a' => 1));

				$recs = self::getChatRecords($guest['gid'], $guest['grid']); //获取聊天记录

				//记录仍然在线的属于自己的客人, au指上传授权(来自页面fromurl丢失)
				$guest_list[] = array('g' => $guest['gid'], 'oid' => $guest['oid'], 'n' => $guest['fullname'], 'iz' => $guest['ipzone'], 'l' => $guest['lang'], 'au' => $guest['au'], 'mb' => $guest['mb'], 'fr' => "", 're' => $recs);
			}
		}
		$_SESSION['guest_num'] = count($guest_list); //计算自己的客人数

		//检查本组是否开启了机器人
		$robot_online = 0;

		$dd = array('x' => 2, 'a' => 8, 'ix' => $client_id, 'irb' => $robot_online, 'rn' => "", 'rp' => "", 'al' => $admin_list, 'gl' => $guest_list);

		self::sendToClient($client_id, $dd);
   }


   /**
    * supportChat 客服群聊
    * @param string $client_id 连接id
    * @param string $msg 消息
    */
   private static function supportChat($client_id, $msg)
   {
		self::checkSupport(); //验证客服

		//管理员或组长特殊指令查询运行数据, 仅包含本组内相关数据
		if($_SESSION['type'] <> 0){
			$spec = 0;
			$titile = "运行数据查询结果:";

			switch($msg){

				case 'all':
					$spec = 1;

					$admins = Gateway::getUidCountByGroup($_SESSION['team_id']); //本组所有客服人数
					$guests = Gateway::getUidCountByGroup($_SESSION['grid']); //本组所有客人数

					$robot_services = 0; //机器人服务人数
					$admin_services = $guests - $robot_services; //客服服务人数

					$msg = Iif($_SESSION['type'] == 1, "All connections = " . Gateway::getAllClientIdCount() . "<br>"); //管理员专有

					$msg .= "Team connections = " . ($admins + $guests) . "<br>Team admins = {$admins}<br>Team guests = {$guests}<br>Team admin services = {$admin_services}<br>Team robot services = {$robot_services}";

					break;

				case 'admin':
					$spec = 1;
					$msg = 'Team total admins = ' . Gateway::getUidCountByGroup($_SESSION['team_id']);

					$get_sessions = Gateway::getClientSessionsByGroup($_SESSION['team_id']);

					foreach($get_sessions AS $s){
						$msg .= "<br>$s[fullname] guests = $s[guest_num]";
					}

					break;

				case 'guest':
					$spec = 1;

					$guests = Gateway::getUidCountByGroup($_SESSION['grid']); //本组所有客人数
					$robot_services = 0; //机器人服务人数
					$admin_services = $guests - $robot_services; //客服服务人数

					$msg = "Team total guests = $guests<br>Team admin guests = {$admin_services}<br>Team robot guests = {$robot_services}";

					break;

				case 'robot':
					$spec = 1;
					$robot_status = "Off";

					$msg = "Team robot status = {$robot_status}<br>Team robot total guests = 0<br>Team robot current guests = 0";

					break;
			}

			//仅将查询数据发送给自己
			if($spec){
				$dd = array('x' => 1, 'aid'=> $_SESSION['aid'], 'av'=> $_SESSION['avatar'], 'n'=> $_SESSION['fullname'], 'p'=> $titile, 't' => $_SESSION['type'], 'i' => $msg);

				self::sendToClient($client_id, $dd);
				return true;
			}
		}

		$dd = array('x' => 1, 'aid'=> $_SESSION['aid'], 'av'=> $_SESSION['avatar'], 'n'=> $_SESSION['fullname'], 'p'=> $_SESSION['post'], 't' => $_SESSION['type'], 'i' => $msg);

		Gateway::sendToGroup($_SESSION['team_id'], json_encode($dd));
   }


   /**
    * sayToGuest 客服给客人发消息
    * @param string $client_id 连接id
    * @param int $gid 访客id
    * @param string $msg 消息
    */
   private static function sayToGuest($client_id, $gid, $msg)
   {
		self::checkSupport(); //验证客服

		if(!$gid OR !$msg) return;

		$guest = self::getSessionByGid($gid);

		/*   客人离线时，客服不能发信息给客人
		if(!$guest) return;

		self::sendToClient($guest['client_id'], array('x' => 5, 'a' => 1, 'i' => $msg)); //给客人
		self::sendToClient($client_id, array('x' => 5, 'a' => 1, 'g' => $gid, 'i' => $msg)); //给自己

		$toname = Iif($guest['fullname'], $guest['fullname'], Iif($guest['lang'], '客人', 'Guest') . $gid);

		self::$DB->exe("INSERT INTO " . TABLE_PREFIX . "msg (type, grid, fromid, fromname, toid, toname, msg, time)
				VALUES (1, '" . $_SESSION['grid'] . "', '" . $_SESSION['aid'] . "', '" . $_SESSION['fullname'] . "', '$gid', '$toname', '$msg', '" . time() . "')");

		*/

		//客人离线时，客服仍然能发信息 begin

		$is_my_guest = 1; //此客人是否属于当前客服
		$fromid = $_SESSION['aid']; //客服的ID

		//此客人在线时
		if($guest){
			$guest_aid = $guest['aid']; //此客人的客服ID

			if($guest_aid != $fromid) $is_my_guest = 0; //说明此客人被转接了

			if($is_my_guest){
				self::sendToClient($guest['client_id'], array('x' => 5, 'a' => 1, 'i' => $msg)); //给客人
			}
		}

		//排除客人被转接后仍然能对其说话
		if($is_my_guest){
			self::sendToClient($client_id, array('x' => 5, 'a' => 1, 'g' => $gid, 'i' => $msg)); //给自己

			$toname = Iif($guest['fullname'], $guest['fullname'], Iif($guest['lang'], '客人', 'Guest') . $gid);

			self::$DB->exe("INSERT INTO " . TABLE_PREFIX . "msg (type, grid, fromid, fromname, toid, toname, msg, time)
					VALUES (1, '" . $_SESSION['grid'] . "', '$fromid', '" . $_SESSION['fullname'] . "', '$gid', '$toname', '$msg', '" . time() . "')");

		}

		//客人离线时，客服仍然能发信息 end

   }


   /**
    * supportHandle 管理员操作
    * @param string $client_id 连接id
    * @param object $data 数据对象
    */
   private static function supportHandle($client_id, $data)
   {
		self::checkSupport(); //验证客服

		$operate = $data->operate;

		switch($operate){

			case 'get_guest': //获取客人信息

				$gid = forceInt($data->guestid);

				if($gid){
					$guest = self::$DB->getOne("SELECT lastip, ipzone, fromurl, grade, fullname, address, phone, email, remark FROM " . TABLE_PREFIX . "guest WHERE gid = '$gid'");
					if(!empty($guest)) {
						$dd = array('x' => 2, 'a' => 5, 'g' => $gid, 'd' => $guest);
						self::sendToClient($client_id, $dd); //返回数据给自己
					}
				}

				break;

			case 'save_guest': //保存客人信息

				$gid = forceInt($data->guestid);

				if($gid){
					$msg = $data->msg;

					$grade = forceInt($msg->grade);
					$fullname = forceString($msg->fullname);
					$address = forceString($msg->address);
					$phone = forceString($msg->phone);
					$email = forceString($msg->email);
					$remark = forceString($msg->remark);

					//更新在线访客的姓名
					$gix_arr = Gateway::getClientIdByUid($gid); //访客连接id数组
					foreach($gix_arr AS $gix){
						Gateway::updateSession($gix, array('fullname' => $fullname));
					}

					//保存到数据库
					self::$DB->exe("UPDATE " . TABLE_PREFIX . "guest SET grade = '$grade', fullname = '$fullname', address = '$address', phone = '$phone', email = '$email', remark = '$remark' WHERE gid = '$gid'");

					$dd = array('x' => 2, 'a' => 6, 'g' => $gid, 'n' => $fullname); //返回数据给自己
					self::sendToClient($client_id, $dd);
				}

				break;

			case 'trans_guest': //转接客人

				self::tranferGuest($client_id, $data, 0); //0表示客服主动转接客人

				break;

			case 'banned': //禁言及解除

				$gid = forceInt($data->guestid);
				$ban = forceInt($data->ban);

				$reply = Iif($ban, 7, 10); //发送给访客的信息

				$gix_arr = Gateway::getClientIdByUid($gid); //访客连接id数组

				foreach($gix_arr AS $gix){
					self::sendToClient($gix, array('x' => 6, 'a' => $reply)); //给客人发送授权通知
				}

				break;

			case 'kickout': //踢出客人

				$gid = forceInt($data->guestid);

				$gix_arr = Gateway::getClientIdByUid($gid); //访客连接id数组

				foreach($gix_arr AS $gix){
					if($_SESSION['guest_num'] > 0) $_SESSION['guest_num'] -= 1; //当前客服的客人数减1

					self::sendToClient($gix, array('x' => 6, 'a' => 6)); //给客人发踢出指令
					Gateway::closeClient($gix); //关闭连接
				}

				self::$DB->exe("UPDATE " . TABLE_PREFIX . "guest SET kickouts = (kickouts + 1) WHERE gid = '$gid'"); //记录在案

				break;

			case 'hangup': //挂起及解除

				$value = forceInt($data->value);

				if($value){ //挂起
					$reply = 3;
					$_SESSION['busy'] = 1;
				}else{ //解除
					$reply = 4;
					$_SESSION['busy'] = 0;
				}

				Gateway::sendToGroup($_SESSION['team_id'], json_encode(array('x' => 2, 'a' => $reply, 'ix' =>$client_id)));

				break;

		}
   }


   /**
    * 客服验证
    * 
    * @return null
    */
   private static function checkSupport()
   {
		//客服类型type: 1 管理员, 2组长, 0 客服
		if(isset($_SESSION['aid']) AND isset($_SESSION['type'])) return;

		//非法操作关闭之
		Gateway::closeClient($_SESSION['client_id']);
   }


   /**
    * 管理员验证
    * 
    * @return null
    */
   private static function checkAdmin()
   {
		//客服类型type: 1 管理员, 2组长, 0 客服
		if(isset($_SESSION['aid']) AND isset($_SESSION['type']) AND $_SESSION['type'] == 1) return;

		//非法操作关闭之
 		Gateway::closeClient($_SESSION['client_id']);
  }

   /**
    * 客服组设置操作验证, 验证管理员或组长
    * 
    * @return null
    */
   private static function checkTeamSetting()
   {
		//客服类型type: 1 管理员, 2组长, 0 客服
		if(isset($_SESSION['aid']) AND isset($_SESSION['type']) AND $_SESSION['type'] <> 0) return;

		//非法操作关闭之
 		Gateway::closeClient($_SESSION['client_id']);
   }


   /**
    * 转接客人给指定客服
    * @param string $client_id
    * @param object $data
    * @param int $guest_query  0表示客服转接客人  1表示客人请求转接客服  2表示客人由机器人转接人工客服
    * 
    * @return null
    */
	private static function tranferGuest($client_id, $data, $guest_query = 0)
	{
		if($guest_query == 1){//客人请求转接客服(客服离线时)

			$support = self::selectSupport(0, $_SESSION['grid']); //分配客服

			//无法分配客服, 返回特殊信息通知客人
			if($support === false){
				self::sendToClient($client_id, array('x' => 6, 'a' => 9, 'i' => $_SESSION['grid']));
				Gateway::closeClient($client_id); //关闭连接, 转入留言板
				return false;
			}

			//更新当前客人的信息
			$_SESSION['aid'] = $support['aid'];
			$_SESSION['aix'] = $support['client_id'];

			$guest = $_SESSION; //客人的session

		}else{ //客服转接客人

			$gid = forceInt($data->guestid);
			$aix = forceString($data->aix); //接收客服的连接索引client_id

			$guest = self::getSessionByGid($gid); //获取客人的session

			if(!$gid OR !$aix OR !$guest) return false;

			$support = Gateway::getSession($aix); //接收的客服

			//接收的客服不在线时
			if(!$support){
				self::sendToClient($client_id, array('x' => 6, 'a' => 11, 'g' => $gid, 'i' => 0)); //转接失败 通知当前客服
				return false;
			}

			//更新被转接客人的信息
			$guest['aid'] = $support['aid'];
			$guest['aix'] = $aix;
			Gateway::updateSession($guest['client_id'], array('aid' => $support['aid'], 'aix' => $aix));
		}

		//根据客人的语言选择客服信息
		if($guest['lang']){ //中文
			$a_n = $support['fullname'];
			$a_p = $support['post'];
		}else{
			$a_n = $support['fullname_en'];
			$a_p = $support['post_en'];
		}

		$avatar = $support['avatar'];

		$is_robot = 0;

		$gid = $guest['gid'];
		$grid = $guest['grid']; //客服组id

		$recs = self::getChatRecords($gid, $grid); //获取聊天记录

		//给接收的客服发一条客人上线通知, 及最近的对话记录 
		$dd = array('x' => 6, 'a' => 8, 'g' => $gid, 'oid' => $guest['oid'], 'n' => $guest['fullname'], 'iz' => $guest['ipzone'], 'au' => $guest['au'], 'l' => $guest['lang'], 'mb' => $guest['mb'], 're' => $recs);
		self::sendToClient($support['client_id'], $dd);

		//给被转接客人发送的信息
		$dd = array('x' => 6, 'a' => 11, 'aid' => $guest['aid'], 'an' => $a_n, 'p' => $a_p, 'av' => $avatar, 'au' => $guest['au'], 'irb' => $is_robot);
		
		//客人请求转接时(包括客服断线转接及由机器人转接人工客服)
		if($guest_query){
			//给客人自己发转接通知
			self::sendToClient($client_id, $dd);

		//客服转接客人时
		}else{
			//给被转接的客人发通知
			self::sendToClient($guest['client_id'], $dd);

			//给客服自己发一条转接成功的信息
			self::sendToClient($client_id, array('x' => 6, 'a' => 11, 'g' => $guest['gid'], 'i' => 1));

			if($_SESSION['guest_num'] > 0) $_SESSION['guest_num'] -= 1; //当前客服的客人数减1
			Gateway::updateSession($support['client_id'], array('guest_num' => $support['guest_num'] + 1)); //接收的客服客人数加1
		}
		
		self::$DB->exe("UPDATE " . TABLE_PREFIX . "guest SET aid = '{$guest[aid]}' WHERE gid = '{$guest[gid]}'"); //更新数据库访客的客服id
	}


	/**
    * clearGuest 清除重复连接的访客
    * @param int $gid 访客id
    * @param int $aix 客服的连接id
    */
   private static function clearGuest($gid, $aix)
   {
	   if(!$gid) return;

	   $client_ids = Gateway::getClientIdByUid($gid); //返回连接id数组

	   foreach($client_ids AS $client_id){
			//先给此连接的访客发送一个废弃连接的通话
			self::sendToClient($client_id, array('x' => 6, 'a' => 4));

			$guest = Gateway::getSession($client_id);

			//如果重复连接的客人的客服连接id与新分配的客服连接id相同
			if($guest['aix'] == $aix) {
				Gateway::updateSession($client_id, array('grid' => 0)); //清除重复连接的客人的组id, 用于阻止给同一客服发送离线信息
			}

			Gateway::closeClient($client_id); //关闭连接
	   }
   }


	/**
    * getChatRecords 获取访客的对话记录
    * @param int $gid 访客id
    * @param int $group_id 客服组
    * 
    * return array
    */
   private static function getChatRecords($gid, $group_id)
   {
	   $recs = array();

		$limit = forceInt(self::$_CFG['Record']);

		if($limit){
			$records = self::$DB->query("SELECT type, fromid, fromname, msg, filetype, time FROM " . TABLE_PREFIX . "msg WHERE grid = '$group_id' AND ((type = 0 AND fromid = '$gid') OR (type = 1 AND toid = '$gid')) ORDER BY mid DESC LIMIT $limit");

			while($r = self::$DB->fetch($records)){
				$recs[] = array('t' =>$r['type'], 'fid' =>$r['fromid'], 'f' =>$r['fromname'], 'm' => $r['msg'], 'ft' => $r['filetype'], 'd' => displayDate($r['time'], 'H:i:s', 1));
			}

			$recs = array_reverse($recs); //数组反转一下
		}

		return $recs;
   }

	/**
    * guestLogin 访客登录验证
    * @param string $client_id 连接id
    * @param object $data 登录时请求的数据对象
    */
	private static function guestLogin($client_id, $data)
	{
		$key = $data->key;
		$code = $data->code;
		$decode = authCode($code, 'DECODE', $key);
		if($decode != md5(WEBSITE_KEY . self::$_CFG['KillRobotCode'])){
			Gateway::closeClient($client_id); //非法连接关闭之
			return false;
		}

		// 认证成功，删除 6秒关闭连接 的定时器
		Timer::del($_SESSION['auth_timer_id']);

		$lastip = $_SERVER['REMOTE_ADDR']; //获得连接的ip

		//WeLive防火墙
		if(preg_match("/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/", $lastip)){
			$is_banned = self::$DB->getOne("SELECT fid FROM " . TABLE_PREFIX . "firewall WHERE ip = '$lastip' AND expire > " . time());
			if($is_banned){
				self::sendToClient($client_id, array('x' => 6, 'a' => 6)); //访客显示被踢出
				Gateway::closeClient($client_id); //关闭连接

				self::$DB->exe("UPDATE " . TABLE_PREFIX . "firewall SET bans = (bans + 1) WHERE fid = " . $is_banned['fid']); //记录次数
				return false;
			}
		}

		//客人验证成功
		$oid = forceInt($data->oid); //原调用网站用户id ---接口

		$gid = forceInt($data->gid); //如果有访客id
		$aid = forceInt($data->aid); //客服id
		$fullname = forceString(html($data->fn)); //客人姓名, 先转换成html再过虑, 否则会&等符号会被重复过虑

		$group_id = forceInt($data->group); //客服组id

		//检查非默认客服组是否存在或关闭
		if($group_id <> 1){
			$checkgroup = self::$DB->getOne("SELECT id FROM " . TABLE_PREFIX . "group WHERE id = '$group_id' AND activated = 1");

			if(!$checkgroup){
				if(self::$_CFG['AutoTrans']){
					$group_id = 1; //客服组不存在或已关闭时，自动转接至默认客服组
				}else{
					self::sendToClient($client_id, array('x' => 6, 'a' => 9, 'i' => 88888888));
					Gateway::closeClient($client_id); //关闭连接
					return false;
				}
			}
		}
		
		$first_connect = Iif($aid, 0, 1); //如果返回了aid, 表示不是首次连接, 而是断线重连

		$hasRecord = 0; //客人是否在数据库里
		$authupload = forceInt($data->au); //客人是否有上传授权
		$session = md5(uniqid(COOKIE_KEY. microtime())); //产生一个session会话记录, 用于验证上传图片, 以免产生非法操作

		//如果有原网站用户id
		if($oid){
			$guest = self::$DB->getOne("SELECT gid FROM " . TABLE_PREFIX . "guest WHERE oid = '$oid'");

			if($guest) $gid = $guest['gid']; //继续使用原gid
		}

		//首次连接成功后, 获取访客数据
		if($gid AND $first_connect){ //首次连接且有gid时, 断线重连时无需获取访客信息
			$guest = self::$DB->getOne("SELECT aid, grid, fullname, upload FROM " . TABLE_PREFIX . "guest WHERE gid = '$gid'");

			if($guest AND $guest['aid']) {
				$aid = $guest['aid']; //以前服务过的客服aid
				if(!$fullname AND $guest['fullname']) $fullname = $guest['fullname'];
				$hasRecord = 1;
				$authupload = $guest['upload'];
			}
		}

		$is_robot = 0; //当前客服组是否是机器人在服务

		//分配客服
		$support = self::selectSupport($aid, $group_id); //返回客服的session数组
		$aix = $support['client_id']; //客服的连接id

		if($support === false){ //无法分配客服, 返回特殊信息通知客人

			self::sendToClient($client_id, array('x' => 6, 'a' => 9, 'i' => $group_id));
			Gateway::closeClient($client_id); //关闭连接
			return false;
		}

		Gateway::updateSession($aix, array('guest_num' => $support['guest_num'] + 1)); //客服的客人数加1

		$aid = $support['aid']; //选择客服成功后重新定义aid

		$lang = forceInt($data->lang);
		$fromurl = forceString($data->fromurl);
		$browser = forceString($data->agent);
		$mobile = forceInt($data->mobile); //是否为移动端

		$ipzone = trim(convertipTiny($lastip)); //IP归属地
		if($ipzone != "中国"){
			$ipzone = str_replace(array("中国", "台湾", "香港", "澳门"), array("", "中国台湾", "中国香港", "中国澳门"), $ipzone);
		}

		$timenow = time();

		$recs = array(); //聊天记录

		if($gid AND $first_connect AND $hasRecord){  //首次连接, 有gid, 且在数据库中有记录时, 更新存在的客人信息 === 即老客人第一次登录, 非重连

			self::$DB->exe("UPDATE " . TABLE_PREFIX . "guest SET aid = '$aid', grid = '$group_id', oid = '$oid', lang ='$lang', logins = (logins + 1), last = '$timenow', lastip = '$lastip', ipzone = '$ipzone', browser = '$browser', mobile = '$mobile', fromurl = '$fromurl', fullname = '$fullname', session = '$session' WHERE gid = '$gid'");

			$recs = self::getChatRecords($gid, $group_id); //获取聊天记录

		}elseif($first_connect){ //首次连接且客人不存在时添加新客人

			self::$DB->exe("INSERT INTO " . TABLE_PREFIX . "guest (aid, grid, oid, upload, lang, last, lastip, ipzone, browser, mobile, fromurl, fullname, remark, session)
					VALUES ('$aid', '$group_id', '$oid', '0', '$lang', '$timenow', '$lastip', '$ipzone', '$browser', '$mobile', '$fromurl', '$fullname', '', '$session')");

			$gid = self::$DB->insert_id; //新客人的ID号

		}else{ //客人断线重新连接
			$recs = self::getChatRecords($gid, $group_id); //获取聊天记录

			self::$DB->exe("UPDATE " . TABLE_PREFIX . "guest SET session = '$session' WHERE gid = '$gid'"); //更新客人的session
		}

		//绑定gid前判断客人是否已经在线
		if(Gateway::isUidOnline($gid)){
			self::clearGuest($gid, $aix); //清理已经存在的连接
		}

		//绑定访客id
		Gateway::bindUid($client_id, $gid);

		//记录访客信息
		$_SESSION['client_id'] = $client_id;
		$_SESSION['gid'] = $gid;
		$_SESSION['grid'] = $group_id; //访客组id, 即客服组id
		$_SESSION['oid'] = $oid; //原网站用户id ----暂时无用
		$_SESSION['fullname'] = $fullname;
		$_SESSION['ipzone'] = $ipzone;
		$_SESSION['mb'] = $mobile;
		$_SESSION['au'] = $authupload; //上传授权
		$_SESSION['lang'] = $lang; //语言

		$_SESSION['aid'] = $aid; //客服id
		$_SESSION['aix'] = $aix; //客服或机器人的client_id

		//加入访客组
		Gateway::joinGroup($client_id, $group_id);

		//人工服务时, 给客服发送通知: 客人上线
		if(!$is_robot){
			$dd = array('x' => 6, 'a' => 8, 'g' => $gid, 'oid' => $oid, 'au' => $authupload, 'n' => $fullname, 'fr' => $fromurl, 'iz' => $ipzone, 'l' => $lang, 'mb' => $mobile, 're' => $recs);
			self::sendToClient($aix, $dd);
		}

		//发送客人登录成功通知, 及客服信息
		if($lang){ //中文
			$a_n = $support['fullname'];
			$a_p = $support['post'];
		}else{
			$a_n = $support['fullname_en'];
			$a_p = $support['post_en'];
		}

		$avatar = $support['avatar'];

		//登录成功返回信息给自己
		$dd = array('x' => 6, 'a' => 8, 'gid' => $gid, 'au' => $authupload, 'irb' => $is_robot, 'sess' => $session, 'fn' => $fullname, 'aid' => $aid, 'an' => $a_n, 'p' => $a_p, 'av' => $avatar, 're' => $recs);
		self::sendToClient($client_id, $dd);
	}


	/**
    * selectSupport 已连接的客人分配客服
	*
    * @param int $aid 连接id
    * @param int $group_id 客服组id
	*
    * @return arrary 客服的session
    */
	private static function selectSupport($aid, $group_id)
	{
		$support = false; //客服的session
		$min = 100000;
		$team_id = "a_{$group_id}"; //worker客服组id, 避免重复, 客服前使用a_识别

		//获取当前客服组中所有客服的session
		$sessions = Gateway::getClientSessionsByGroup($team_id);

		//先匹配曾经服务过的客服(老客人优生分配给老客服), 且老客服不挂起时
		if($aid){
			foreach($sessions as $client_id => $session) {
				if($session['aid'] == $aid AND !$session['busy']){
					return $session; //如果原来的客服在线, 直接分配给原客服
				}
			}
		}

		//未找到老客服, 继续分配
		$keys = array_keys($sessions);
		shuffle($keys); //随机打乱数组顺序

		//找最少客人且未挂起的客服
		foreach($keys as $k) {
			if(!$sessions[$k]['busy']){ //找未挂起的客服
				if($sessions[$k]['guest_num'] < $min){
					$min = $sessions[$k]['guest_num'];
					$support = $sessions[$k];
				}
			}
		}

		//如果未找客服(无客服或都挂起), 重新查找(不限挂起状态)
		if($support === false){
			foreach($keys as $k) {
				if($sessions[$k]['guest_num'] < $min){
					$min = $sessions[$k]['guest_num'];
					$support = $sessions[$k];
				}
			}
		}

		return $support; //找到客服返回客服的session, 未找到返回false
	}


   /**
    * 客人验证
    * 
    * @return null
    */
	private static function checkGuest()
	{
		if(isset($_SESSION['gid']) AND isset($_SESSION['aid'])) return;

		//非法操作关闭之
		Gateway::closeClient($_SESSION['client_id']);
	}


   /**
    * sayToSupport 客人给客服发消息
    * @param string $client_id 连接id
    * @param string $msg 消息
    */
   private static function sayToSupport($client_id, $msg)
   {
		self::checkGuest(); //验证客人

		if(!$msg) return;

		$aix = $_SESSION['aix']; //客服的连接索引

		$support = Gateway::getSession($aix);
		if(!$support) return;

		self::sendToClient($client_id, array('x' => 5, 'a' => 2)); //返回给客人自己一条简单信息

		$dd = array('x' => 5, 'a' => 2, 'g' => $_SESSION['gid'], 'i' => $msg);
		self::sendToClient($aix, $dd); //将信息发给客服

		$fromid = $_SESSION['gid'];
		$fromname = Iif($_SESSION['fullname'], $_SESSION['fullname'], Iif($_SESSION['lang'], '客人', 'Guest') . $fromid);

		self::$DB->exe("INSERT INTO " . TABLE_PREFIX . "msg (type, grid, fromid, fromname, toid, toname, msg, time)
				VALUES (0, '" . $_SESSION['grid'] . "', '$fromid', '$fromname', '" . $_SESSION['aid'] . "', '" . $support['fullname'] . "', '$msg', '" . time() . "')");
   }


   /**
    * guestHandle 访客发起的相关操作
    * @param string $client_id 连接id
    * @param object $data 数据对象
    */
   private static function guestHandle($client_id, $data)
   {
		self::checkGuest(); //验证客人

		$operate = $data->operate;

		switch($operate){

			case 'rating': //服务评价

				$gid = $_SESSION['gid']; //访客id
				$aid = $_SESSION['aid']; //客服id

				$score = forceInt($data->star);
				$msg = forceString($data->msg);

				if(!$score OR !$aid) return false;

				//每天仅允许评价2次
				$max_rating = 2;
				$sql_time = time() - 3600*24;
				$result = self::$DB->getOne("SELECT COUNT(rid) AS nums FROM " . TABLE_PREFIX . "rating WHERE gid = '{$gid}' AND aid = '{$aid}' AND time > '{$sql_time}'");

				if($result AND $result['nums'] >= $max_rating){
					self::sendToClient($client_id, array('x' => 6, 'a' => 14, 's' => 2)); //失败 评价超每天限制的数量
					return false;
				}

				self::$DB->exe("INSERT INTO " . TABLE_PREFIX . "rating (gid, aid, score, msg, time)
						VALUES ('$gid', '$aid', '$score', '$msg', '" . time() . "')");

				self::sendToClient($client_id, array('x' => 6, 'a' => 14, 's' => 1)); //成功 返回给客人自己

				break;

			case 'callback': //请求回拨电话

				$msg = forceString($data->msg);

				if(strlen($msg) > 100){
					Gateway::closeClient($client_id); //非法信息, 断开连接
					return false;
				}

				$aix = $_SESSION['aix']; //客服的连接索引

				$support = Gateway::getSession($aix); //获取客服session
				if(!$support) return false;

				self::sendToClient($client_id, array('x' => 6, 'a' => 13)); //返回给客人自己一条简单信息
				self::sendToClient($aix, array('x' => 6, 'a' => 13, 'g' => $_SESSION['gid'], 'i' => $msg)); //将信息发给客服

				//保存记录
				$fromname = Iif($_SESSION['fullname'], $_SESSION['fullname'], Iif($_SESSION['lang'], '客人', 'Guest') . $_SESSION['gid']);

				self::$DB->exe("INSERT INTO " . TABLE_PREFIX . "msg (type, grid, fromid, fromname, toid, toname, msg, time)
						VALUES (0, '" . $_SESSION['grid'] . "', '" . $_SESSION['gid'] . "', '$fromname', '" . $_SESSION['aid'] . "', '" . $support['fullname'] . "', '$msg', '" . time() . "')");

				break;

			case 'redistribute': //请求重新分配客服(客服断线)

				//客人转接给客服
				self::tranferGuest($client_id, $data, 1); //1表示客服断线时请求的重新分配客服

				break;

			case 'offline': //访客自动离线

				self::sendToClient($client_id, array('x' => 6, 'a' => 5)); //返回给自己
				Gateway::closeClient($client_id); //断开连接

				break;

		}
   }


}

?>
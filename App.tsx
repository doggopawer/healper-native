import { useEffect, useState } from "react";
import {
  Dimensions,
  SafeAreaView,
  StyleSheet,
  AppState,
  Vibration,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import axios from "axios";

const deviceHeight = Dimensions.get("window").height;
const deviceWidth = Dimensions.get("window").width;

const App = () => {
  const [pushToken, setPushToken] = useState("");
  const [appState, setAppState] = useState(AppState.currentState);
  const [notificationId, setNotificationId] = useState("");

  useEffect(() => {
    (async () => {
      // 푸시 알림 권한 요청
      try {
        const { status } = await Notifications.getPermissionsAsync();
        // 권한이 없으면 요청
        if (status !== "granted") {
          const { status: newStatus } =
            await Notifications.requestPermissionsAsync();
          if (newStatus !== "granted") {
            alert("알림 권한이 필요합니다!");
            return;
          }
        }

        // Expo 푸시 알림 토큰 가져오기
        const token = (
          await Notifications.getExpoPushTokenAsync({
            projectId:
              Constants?.expoConfig?.extra?.eas?.projectId ??
              Constants?.easConfig?.projectId,
          })
        ).data;
        console.log("푸시 알림 토큰", token);
        setPushToken(token);
        // 이 토큰을 서버에 등록하는 로직 추가
        console.log("엑스포 서버에 전송");
      } catch (err) {
        console.log("에러", err);
      }
    })();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    (async () => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: appState === "background", // 백그라운드 상태일 때만 알림 표시
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    })();
  }, [appState]);

  const handleReactMessageSend = async (event: WebViewMessageEvent) => {
    console.log("리액트가 보낸 메시지", event.nativeEvent.data);

    // 데이터를 파싱하여 타입을 지정합니다.
    const data = JSON.parse(event.nativeEvent.data);

    if (data.type === "timer") {
      const timeToNotify = new Date(data.date); // ISO 형식의 날짜 문자열
      console.log("이런 데이터를 받았어요", data);

      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        console.log("기존 알림이 취소되었습니다.");
      }

      // 항상 로컬 알림 예약
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "시간이 되었습니다!",
          body: "휴식 시간이 끝났습니다.",
        },
        trigger: {
          date: timeToNotify,
        },
      });
      setNotificationId(id); // 알림 ID 저장

      console.log("로컬 알림이 예약되었습니다.", timeToNotify);
    }

    if (data.type === "vibrate") {
      Vibration.vibrate(200);
    }

    // 푸시 토큰 저장 로직
    if (!data.type) {
      try {
        const response = await axios.post(
          "https://www.healper.shop/api/save_token", // API 엔드포인트
          { token: pushToken }, // 요청 본문에 푸시 토큰 포함
          {
            headers: {
              Authorization: `Bearer ${data.accessToken}`, // 액세스 토큰 포함
              "Content-Type": "application/json", // JSON 형식으로 전송
            },
          }
        );

        console.log("Response:", response.data);
      } catch (error) {
        console.error("Error saving push token:", error);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        javaScriptEnabled={true}
        allowFileAccess={true}
        style={styles.webview}
        source={{
          uri: "https://www.healper.shop",
        }}
        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1" // 사용자 에이전트 설정
        onMessage={handleReactMessageSend}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error("WebView error: ", nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error("HTTP error: ", nativeEvent);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
  },
  webview: {
    flex: 1,
    width: deviceWidth,
    height: deviceHeight,
  },
});

export default App;

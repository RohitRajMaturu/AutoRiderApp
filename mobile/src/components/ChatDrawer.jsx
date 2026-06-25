import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MessageCircle, Send, X } from "lucide-react-native";
import { toast } from "sonner-native";
import { useAuth } from "@/utils/auth/useAuth";
import { ICON } from "@/theme/iconScale";

const PRIMARY = "#43B8B3";
const SURFACE = "#FFFFFF";
const BG = "#EAF0F1";
const BORDER = "#D8E4E5";
const TEXT = "#17272B";
const TEXT_SECONDARY = "#586C70";
const TEXT_MUTED = "#647678";
const QUICK_REPLIES = {
  passenger: [
    "I am at the pickup point",
    "Please call when you arrive",
    "Please wait for 2 minutes",
    "Where are you?",
  ],
  driver: [
    "I am on the way",
    "I have arrived at the pickup point",
    "Please come to the pickup point",
    "Traffic is heavy, I may be delayed",
  ],
};

function formatTime(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function upsertMessage(messages, nextMessage) {
  const existingIndex = messages.findIndex((message) => message.id === nextMessage.id);
  if (existingIndex === -1) return [...messages, nextMessage];
  const next = [...messages];
  next[existingIndex] = {
    ...next[existingIndex],
    ...nextMessage,
    status: next[existingIndex].status === "read" ? "read" : nextMessage.status || "sent",
  };
  return next;
}

function deliveryLabel(status) {
  if (status === "sending") return "Sending";
  if (status === "read") return "Read";
  if (status === "failed") return "Not sent";
  return "Sent";
}

export default function ChatDrawer({ rideId, pusherChannel, role }) {
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const isOpenRef = useRef(false);
  const seenIncomingIdsRef = useRef(new Set());
  const drawerMaxHeight = Math.min(600, Math.round(windowHeight * 0.78));

  useEffect(() => {
    setMessages([]);
    setInputText("");
    setUnread(0);
    setIsOpen(false);
    isOpenRef.current = false;
    seenIncomingIdsRef.current.clear();
    slideAnim.setValue(0);
  }, [rideId, slideAnim]);

  const markRead = useCallback(
    async (lastMessageId) => {
      if (!lastMessageId || !auth?.jwt || !rideId) return;
      try {
        const baseUrl = process.env.EXPO_PUBLIC_BASE_URL || "";
        await fetch(`${baseUrl}/api/rides/${rideId}/chat`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.jwt}`,
          },
          body: JSON.stringify({ lastMessageId }),
        });
      } catch {
        // Read receipts are best-effort.
      }
    },
    [auth?.jwt, rideId],
  );

  const openDrawer = useCallback(
    (lastIncomingMessageId) => {
      setIsOpen(true);
      isOpenRef.current = true;
      setUnread(0);
      if (lastIncomingMessageId) markRead(lastIncomingMessageId);
      requestAnimationFrame(() => {
        Animated.spring(slideAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }).start();
      });
    },
    [markRead, slideAnim],
  );

  useEffect(() => {
    if (!pusherChannel) return undefined;

    const messageHandler = (data) => {
      if (!data?.text || !data?.senderRole || !data?.sentAt) return;
      const message = {
        id: data.id || `${data.sentAt}-${data.senderRole}-${data.text}`,
        text: String(data.text).slice(0, 200),
        senderRole: data.senderRole,
        sentAt: data.sentAt,
        isMine: data.senderRole === role,
        status: "sent",
      };
      if (!message.isMine) seenIncomingIdsRef.current.add(message.id);
      setMessages((current) => upsertMessage(current, message));
      if (!message.isMine) openDrawer(message.id);
    };

    const readHandler = (data) => {
      if (!data?.readerRole || data.readerRole === role) return;
      setMessages((current) =>
        current.map((message) =>
          message.isMine && message.status !== "failed"
            ? { ...message, status: "read", readAt: data.readAt }
            : message,
        ),
      );
    };

    pusherChannel.bind("chat-message", messageHandler);
    pusherChannel.bind("chat-read", readHandler);
    return () => {
      pusherChannel.unbind("chat-message", messageHandler);
      pusherChannel.unbind("chat-read", readHandler);
    };
  }, [openDrawer, pusherChannel, role]);

  const refreshMessages = useCallback(async () => {
    if (!auth?.jwt || !rideId) return;

    try {
      const baseUrl = process.env.EXPO_PUBLIC_BASE_URL || "";
      const response = await fetch(`${baseUrl}/api/rides/${rideId}/chat`, {
        headers: { Authorization: `Bearer ${auth.jwt}` },
      });
      if (!response.ok) return;

      const body = await response.json().catch(() => ({}));
      const fetched = (body.messages || []).map((message) => ({
        ...message,
        isMine: message.senderRole === role,
        status: message.senderRole === role && message.readAt ? "read" : "sent",
      }));
      const newUnread = fetched.filter(
        (message) =>
          !message.isMine &&
          !message.readAt &&
          !seenIncomingIdsRef.current.has(message.id),
      );

      fetched.forEach((message) => {
        if (!message.isMine) seenIncomingIdsRef.current.add(message.id);
      });
      setMessages((current) => fetched.reduce(upsertMessage, current));

      const latestUnread = newUnread[newUnread.length - 1];
      if (latestUnread) openDrawer(latestUnread.id);
    } catch {
      // Retry on the next poll; realtime can still deliver in the meantime.
    }
  }, [auth?.jwt, openDrawer, rideId, role]);

  useEffect(() => {
    if (!auth?.jwt || !rideId) return undefined;
    refreshMessages();
    const timer = setInterval(refreshMessages, 2000);
    return () => clearInterval(timer);
  }, [auth?.jwt, refreshMessages, rideId]);

  useEffect(() => {
    if (messages.length === 0) return undefined;
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [messages]);

  const handleOpenDrawer = useCallback(() => {
    const latestIncoming = [...messages].reverse().find((message) => !message.isMine);
    openDrawer(latestIncoming?.id);
  }, [messages, openDrawer]);

  const closeDrawer = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      isOpenRef.current = false;
      setIsOpen(false);
    });
  }, [slideAnim]);

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isSending || !auth?.jwt || !rideId) return;

    const clientMessageId = `${role}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const optimistic = {
      id: clientMessageId,
      text,
      senderRole: role,
      sentAt: new Date().toISOString(),
      isMine: true,
      status: "sending",
    };
    setMessages((current) => [...current, optimistic]);
    setInputText("");
    setIsSending(true);

    try {
      const baseUrl = process.env.EXPO_PUBLIC_BASE_URL || "";
      const response = await fetch(`${baseUrl}/api/rides/${rideId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.jwt}`,
        },
        body: JSON.stringify({ text, clientMessageId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Message could not be sent");
      }
      const body = await response.json().catch(() => ({}));
      setMessages((current) =>
        current.map((message) =>
          message.id === clientMessageId
            ? {
                ...message,
                sentAt: body.message?.sentAt || message.sentAt,
                status: "sent",
              }
            : message,
        ),
      );
      refreshMessages();
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.id === clientMessageId ? { ...message, status: "failed" } : message,
        ),
      );
      toast.error("Message not sent", {
        description: error.message || "Check your connection and try again.",
      });
    } finally {
      setIsSending(false);
    }
  }, [auth?.jwt, inputText, isSending, refreshMessages, rideId, role]);

  const drawerTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <>
      <TouchableOpacity
        onPress={handleOpenDrawer}
        accessibilityLabel={role === "passenger" ? "Open chat with driver" : "Open chat with passenger"}
        style={{
          position: "relative",
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: PRIMARY,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <MessageCircle size={ICON.md} color="#fff" />
        {unread > 0 ? (
          <View
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: "#DC2626",
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>
              {unread > 9 ? "9+" : unread}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <Modal visible={isOpen} transparent animationType="none" onRequestClose={closeDrawer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
          style={{ flex: 1 }}
        >
          <Pressable
            onPress={closeDrawer}
            style={{ flex: 1, backgroundColor: "#00000055", justifyContent: "flex-end" }}
          >
            <Animated.View style={{ transform: [{ translateY: drawerTranslateY }] }}>
              <Pressable onPress={() => {}}>
                <View
                  style={{
                    backgroundColor: SURFACE,
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    borderColor: BORDER,
                    borderWidth: 1,
                    maxHeight: drawerMaxHeight,
                    paddingBottom: insets.bottom + 8,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: BORDER,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <MessageCircle size={ICON.md} color={PRIMARY} />
                      <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT }}>
                        {role === "passenger" ? "Chat with Driver" : "Chat with Passenger"}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={closeDrawer} hitSlop={12}>
                      <X size={ICON.md} color={TEXT_SECONDARY} />
                    </TouchableOpacity>
                  </View>

                  <FlatList
                    ref={listRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
                    contentContainerStyle={{ padding: 12, gap: 8, flexGrow: 1 }}
                    ListEmptyComponent={
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 32 }}>
                        <Text style={{ color: TEXT_MUTED, fontSize: 13 }}>No messages yet. Say hi!</Text>
                      </View>
                    }
                    style={{ minHeight: 180, maxHeight: 340 }}
                    renderItem={({ item }) => (
                      <View style={{ alignItems: item.isMine ? "flex-end" : "flex-start" }}>
                        <Text style={{ color: TEXT_MUTED, fontSize: 10, marginBottom: 3, paddingHorizontal: 4 }}>
                          {item.isMine ? "You" : role === "passenger" ? "Driver" : "Passenger"}
                        </Text>
                        <View
                          style={{
                            maxWidth: "78%",
                            backgroundColor: item.isMine ? PRIMARY : BG,
                            borderRadius: 16,
                            borderBottomRightRadius: item.isMine ? 4 : 16,
                            borderBottomLeftRadius: item.isMine ? 16 : 4,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            opacity: item.status === "failed" ? 0.55 : 1,
                          }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: "600", color: item.isMine ? "#fff" : TEXT, lineHeight: 20 }}>
                            {item.text}
                          </Text>
                          <Text style={{ fontSize: 10, color: item.isMine ? "#FFFFFFB3" : TEXT_MUTED, marginTop: 3, textAlign: "right" }}>
                            {formatTime(item.sentAt)}
                            {item.isMine ? ` · ${deliveryLabel(item.status)}` : ""}
                          </Text>
                        </View>
                      </View>
                    )}
                  />

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{
                      gap: 8,
                      paddingHorizontal: 12,
                      paddingTop: 10,
                    }}
                  >
                    {QUICK_REPLIES[role].map((reply) => (
                      <TouchableOpacity
                        key={reply}
                        onPress={() => {
                          setInputText(reply);
                          inputRef.current?.focus();
                        }}
                        style={{
                          borderWidth: 1,
                          borderColor: PRIMARY,
                          borderRadius: 16,
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                        }}
                      >
                        <Text style={{ color: PRIMARY, fontSize: 13, fontWeight: "700" }}>
                          {reply}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingHorizontal: 12,
                      paddingTop: 10,
                      borderTopWidth: 1,
                      borderTopColor: BORDER,
                    }}
                  >
                    <TextInput
                      ref={inputRef}
                      value={inputText}
                      onChangeText={setInputText}
                      placeholder="Type a message..."
                      placeholderTextColor={TEXT_MUTED}
                      maxLength={200}
                      multiline
                      onFocus={() => {
                        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
                      }}
                      style={{
                        flex: 1,
                        minHeight: 40,
                        maxHeight: 96,
                        backgroundColor: BG,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: BORDER,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        color: TEXT,
                      }}
                    />
                    <TouchableOpacity
                      onPress={sendMessage}
                      disabled={!inputText.trim() || isSending}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: !inputText.trim() || isSending ? BORDER : PRIMARY,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Send size={ICON.sm} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

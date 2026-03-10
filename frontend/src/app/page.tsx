import ChatContainer from "@/components/ChatContainer";
import Header from "@/components/Header";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header />
      <ChatContainer />
    </main>
  );
}

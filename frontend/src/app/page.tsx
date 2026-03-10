import ChatContainer from "@/components/ChatContainer";
import Header from "@/components/Header";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <ChatContainer />
    </main>
  );
}

const { PrismaClient } = require("@prisma/client");
const CustomError = require("../../utils/CustomError");
const { includes } = require("zod/v4");
const prisma = new PrismaClient();

async function fetchAnswerFromThirdAPI(question) {
  const res = await fetch("https://ai.dcctz.com/demobot/demo-ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ANSWER_API_KEY ?? ""}`,
    },
    body: JSON.stringify({ question }),
  });
  console.log("Third API response status:", res.status);

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `Answer API failed (${res.status}): ${txt || res.statusText}`
    );
  }
  const data = await res.json();
  return data;
  //   if (!data?.answer || typeof data.answer !== "string")
  //     throw new Error("Answer API returned an invalid payload");
  //   return data.answer;
}
// Create a new chat
const askQuestion = async (data) => {
  try {
    const { userId, question, sql_code, categoryTag } = data;
    // const aiAnswer = { text: "This is a placeholder answer." };
    const aiAnswer = await fetchAnswerFromThirdAPI(question);
    // console.log("AI Answer:", aiAnswer);
    const result = await prisma.$transaction(async (tx) => {
      let chatId = data?.chatId ?? null;

      if (chatId != null) {
        const chat = await tx.ChatHistory.findUnique({
          where: { id: chatId },
          select: { id: true, user_id: true },
        });
        if (!chat || chat.user_id !== userId)
          throw new Error("Chat not found or does not belong to this user");
      } else {
        const created = await tx.ChatHistory.create({
          data: {
            user_id: userId,
            startTime: new Date(),
            endTime: new Date(),
            totalMessages: 0,
            title: question.slice(0, 50),
            categoryTag: categoryTag ?? null,
          },
          select: { id: true },
        });
        chatId = created?.id;
      }

      const detail = await tx.chatDetails.create({
        data: {
          chatId: chatId,
          question,
          aiAnswer: aiAnswer?.data ?? "No answer found",
          sql_code: sql_code ?? null,
          categoryTag: categoryTag ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await tx.ChatHistory.update({
        where: { id: chatId },
        data: {
          totalMessages: { increment: 1 },
          endTime: new Date(),
          ...(categoryTag ? { categoryTag } : {}),
        },
      });

      return { chatId, detailId: detail.id };
    });

    return {
      data: result,
      chatId: result.chatId,
      detailId: result.detailId,
      answer: aiAnswer,
    };
  } catch (err) {
    console.error(err);
    const message = err?.message ?? "Internal server error";
    const status = /not found|does not belong|invalid/i.test(message)
      ? 400
      : 500;
    res.status(status).json({ error: message });
    throw new CustomError(`Error creating chat: ${error.message}`, 500);
  }
};

// Find a chat by ID
const getChatDetail = async (id) => {
  try {
    const chat = await prisma.ChatHistory.findUnique({
      where: { id: parseInt(id) },
      include: {
        ChatDetails: true, // load related details
      },
    });

    return chat;
  } catch (error) {
    throw new CustomError(`Error finding chat by ID: ${error.message}`, 503);
  }
};

// Get all chats
const getChatHistory = async (
  userId,
  search,
  page,
  size,
  startDate,
  endDate,
  is_active
) => {
  try {
    const chats = await prisma.ChatHistory.findMany({
      where: { user_id: userId },
      orderBy: [{ startTime: "desc" }, { endTime: "desc" }],
      //   includes: {
      //     ChatDetails: true,
      //   },
    });
    return chats;
  } catch (error) {
    throw new CustomError("Error retrieving chat", 503);
  }
};
const deletChatHistory = async (id) => {
  try {
    const chats = await prisma.ChatHistory.delete({
      where: { id },
    });
    return chats;
  } catch (error) {
    throw new CustomError("Error retrieving chat", 503);
  }
};

module.exports = {
  askQuestion,
  getChatDetail,
  getChatHistory,
  deletChatHistory,
};

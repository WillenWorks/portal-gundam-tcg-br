-- Quantidade de copias dessa impressao especifica dentro de 1 unidade do produto
-- (starter deck, build box, etc) -- so faz sentido pra "colecoes fechadas" (setType
-- != BOOSTER_PACK), onde o conteudo e fixo/conhecido. Nulo por padrao ate ser curado
-- manualmente -- nao tenta adivinhar, so registra o que for confirmado.
ALTER TABLE "Card" ADD COLUMN "quantityInProduct" INTEGER;

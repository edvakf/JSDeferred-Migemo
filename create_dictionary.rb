#!/usr/bin/ruby -Ku
# -*- coding: utf-8 -*-

require 'open-uri'
require 'nkf'

# Some SKK dictionaries are distributed at
# http://openlab.jp/skk/wiki/wiki.cgi?page=SKK%BC%AD%BD%F1
dict_type = 'ML' # L, ML, M, S, etc
dict_url = "http://openlab.jp/skk/skk/dic/SKK-JISYO.#{dict_type}"

dict = {}

open(dict_url) do |f|
  okuri = true
  while line = f.gets
    line = NKF.nkf('-E -w', line)
    if line =~ /^;;\s*okuri-ari entries\.?/
      okuri = true
    elsif line =~ /^;;\s*okuri-nasi entries\.?/
      okuri = false
    elsif line !~ /^;;/ && line =~ /^(\S+)\s+(\/.*\/)/ 
      # line = "しゅん /春/瞬/駿/舜/竣/峻/俊/旬/" 
      #   => $1 = "しゅん", $2 = "春/瞬/駿/舜/竣/峻/俊/旬"
      yomi = $1
      words = $2.split(/(?:;.*?)?\//) # あいべつりく /愛別離苦;愛する者との死別の苦しみ/
      words.delete_if{|w| w.empty?}
      yomi = yomi[0..-2] if okuri
      yomi = yomi.sub(/>/, '')
      if dict.has_key?(yomi)
        dict[yomi] = dict[yomi] | words
      else
        dict[yomi] = words
      end
    end
  end
end

file_ja = './migemo-dict-ja'
file_roman = './migemo-dict-ja-roman'
file_symbol = './migemo-dict-ja-symbol'

f1 = open(file_ja, 'w')
f2 = open(file_roman, 'w')
f3 = open(file_symbol, 'w')

symbols = %w/~ ` ! @ # $ % ^ & * ( ) _ - + = { } [ ] \ | ; : ' " < > , . \//

dict.keys.sort.each do |yomi|
  if symbols.include?(yomi)
    f = f3
  elsif yomi =~ /^[ぁ-ゖー]+$/
    f = f1
  else
    f = f2
  end
  f.puts("#{yomi}\t#{dict[yomi].join("\t")}")
end

f1.close
f2.close
f3.close

